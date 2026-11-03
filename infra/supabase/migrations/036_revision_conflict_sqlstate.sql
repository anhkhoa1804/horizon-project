-- 036: stop signalling a stale-revision conflict with SQLSTATE 40001.
--
-- Finding (found on the isolated local stack, PostgREST 12.2.3): a function that raises SQLSTATE 40001
-- (serialization_failure) makes PostgREST re-run the call in a loop instead of returning an error. For
-- store_remote_config / record_remote_config_event the raise happens AFTER pg_advisory_xact_lock(station),
-- so the retry loop keeps the station lock churning, queues every other config write behind it, exhausts the
-- connection pool (PGRST003) and stalls the Admin. Reproduced with a stale `p_expected_revision`; a function
-- raising a custom code (P0409) returns immediately.
--
-- Change: the two functions are re-created identically except that `revision_conflict` now uses errcode 'P0409'.
-- Validation, locking, optimistic-revision semantics, audit behaviour and grants are unchanged. The web layer maps
-- BOTH 40001 (older database) and P0409 to a conflict. Idempotent (create or replace); no data is touched.
begin;
create or replace function public.store_remote_config(p_config jsonb,p_expected_revision bigint,p_actor text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.device_runtime_configs; c jsonb;
begin
 if not coalesce(public.validate_remote_config(p_config),false) or p_expected_revision is null or p_expected_revision<0 or (p_config->>'config_revision')::bigint<>p_expected_revision+1 then raise exception 'invalid_config' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_config->>'station_id',0));
 select * into r from public.device_runtime_configs where station_id=p_config->>'station_id' for update;
 if coalesce(r.config_revision,0)<>p_expected_revision then raise exception 'revision_conflict' using errcode='P0409'; end if;
 if r.station_id is not null and r.sample_interval_seconds=(p_config->>'sample_interval_seconds')::int and r.sleep_interval_seconds=(p_config->>'sleep_interval_seconds')::int and r.mode=p_config->>'mode' then return jsonb_build_object('changed',false,'config_revision',r.config_revision,'state',r.delivery_state); end if;
 insert into public.device_runtime_configs(station_id,contract_version,config_revision,sample_interval_seconds,sleep_interval_seconds,mode,delivery_state)
 values(p_config->>'station_id',1,(p_config->>'config_revision')::bigint,(p_config->>'sample_interval_seconds')::int,(p_config->>'sleep_interval_seconds')::int,p_config->>'mode','STORED')
 on conflict(station_id) do update set contract_version=1,config_revision=excluded.config_revision,sample_interval_seconds=excluded.sample_interval_seconds,sleep_interval_seconds=excluded.sleep_interval_seconds,mode=excluded.mode,delivery_state='STORED',retrieved_at=null,sent_at=null,acknowledged_at=null,rejected_at=null,last_delivery_at=null,last_failure_reason=null;
 begin
 insert into public.audit_events(actor,action,entity,entity_id,metadata) values(p_actor,'runtime.config.stored','device_runtime_configs',p_config->>'station_id',jsonb_build_object('config_revision',(p_config->>'config_revision')::bigint,'state','STORED','config',p_config,'hardware_verified',false));
 exception when others then raise exception 'audit_failed' using errcode='P0002'; end;
 return jsonb_build_object('changed',true,'config_revision',(p_config->>'config_revision')::bigint,'state','STORED');
end;
$$;

create or replace function public.record_remote_config_event(p_config jsonb,p_state text,p_evidence text,p_actor text,p_reason text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.device_runtime_configs; historical jsonb; rev bigint; inserted int; action_name text; rank_now int; rank_next int;
begin
 if not coalesce(public.validate_remote_config(p_config),false) or p_state not in ('RETRIEVED','SENT','ACKNOWLEDGED','APPLIED','REJECTED','FAILED') or length(coalesce(p_evidence,''))>192 or length(coalesce(p_reason,''))>64 then raise exception 'invalid_event' using errcode='22023'; end if;
 if p_state in ('SENT','ACKNOWLEDGED','APPLIED','REJECTED') and coalesce(p_evidence,'')='' then raise exception 'missing_evidence' using errcode='22023'; end if;
 rev=(p_config->>'config_revision')::bigint;
 perform pg_advisory_xact_lock(hashtextextended(p_config->>'station_id',0));
 select * into r from public.device_runtime_configs where station_id=p_config->>'station_id' for update;
 if r.station_id is null then raise exception 'not_found' using errcode='P0001'; end if;
 select metadata->'config' into historical from public.audit_events where entity='device_runtime_configs' and entity_id=r.station_id and action='runtime.config.stored' and (metadata->>'config_revision')::bigint=rev;
 if historical is null or historical<>p_config then raise exception 'revision_conflict' using errcode='P0409'; end if;
 action_name='runtime.config.'||lower(p_state);
 begin
 insert into public.audit_events(actor,action,entity,entity_id,metadata) values(p_actor,action_name,'device_runtime_configs',r.station_id,jsonb_build_object('config_revision',rev,'state',p_state,'config',p_config,'evidence',p_evidence,'reason',p_reason,'hardware_verified',false)) on conflict do nothing;
 get diagnostics inserted=row_count;
 exception when others then raise exception 'audit_failed' using errcode='P0002'; end;
 if inserted=0 then return jsonb_build_object('duplicate',true,'state',r.delivery_state,'config_revision',r.config_revision); end if;
 if p_state='APPLIED' and rev>coalesce(r.applied_revision,0) then update public.device_runtime_configs set applied_revision=rev,applied_config=p_config,applied_at=now() where station_id=r.station_id; end if;
 if rev=r.config_revision then
 rank_now=array_position(array['UNSET','STORED','RETRIEVED','SENT','ACKNOWLEDGED','FAILED','REJECTED','APPLIED'],r.delivery_state);
 rank_next=array_position(array['UNSET','STORED','RETRIEVED','SENT','ACKNOWLEDGED','FAILED','REJECTED','APPLIED'],p_state);
 update public.device_runtime_configs set delivery_state=case when rank_next>rank_now then p_state else delivery_state end,
 retrieved_at=case when p_state='RETRIEVED' then now() else retrieved_at end,
 sent_at=case when p_state='SENT' then now() else sent_at end,
 acknowledged_at=case when p_state='ACKNOWLEDGED' then now() else acknowledged_at end,
 rejected_at=case when p_state='REJECTED' then now() else rejected_at end,
 last_delivery_at=now(),last_failure_reason=case when r.delivery_state='APPLIED' or p_state='APPLIED' then null when p_state in ('REJECTED','FAILED') and rank_next>=rank_now then p_reason else last_failure_reason end where station_id=r.station_id;
 end if;
 return jsonb_build_object('duplicate',false,'state',(select delivery_state from public.device_runtime_configs where station_id=r.station_id),'config_revision',r.config_revision,'stale',rev<r.config_revision);
end;
$$;

revoke all on function public.store_remote_config(jsonb,bigint,text) from public,anon,authenticated;
revoke all on function public.record_remote_config_event(jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function public.store_remote_config(jsonb,bigint,text),public.record_remote_config_event(jsonb,text,text,text,text) to service_role;
commit;
