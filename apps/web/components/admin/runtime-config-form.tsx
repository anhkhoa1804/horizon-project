"use client";
import { useActionState, useState } from "react";
import type { SaveResult } from "@/lib/gateway/remoteConfigService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
export function RuntimeConfigForm({
  config,
  action,
}: {
  config: {
    station_id: string;
    config_revision?: number;
    sample_interval_seconds: number;
    sleep_interval_seconds: number;
    mode: string;
  };
  action: (previous: SaveResult | null, form: FormData) => Promise<SaveResult>;
}) {
  const [result, submit, pending] = useActionState(action, null);
  // Controlled values survive a rejected server action instead of being reset by React.
  const [sample, setSample] = useState(String(config.sample_interval_seconds));
  const [sleep, setSleep] = useState(String(config.sleep_interval_seconds));
  const [mode, setMode] = useState(config.mode);
  return (
    <form action={submit} className="runtime-settings space-y-3">
      <input type="hidden" name="station_id" value={config.station_id} />
      <input
        type="hidden"
        name="expected_revision"
        value={result?.revision ?? config.config_revision ?? 0}
      />
      <div className="space-y-1.5">
        <Label htmlFor={`${config.station_id}-sample`}>
          Chu kỳ đo/gửi (giây)
        </Label>
        <Input
          id={`${config.station_id}-sample`}
          name="sample_interval_seconds"
          required
          type="number"
          min={5}
          max={86400}
          value={sample}
          onChange={(event) => setSample(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${config.station_id}-sleep`}>
          Thời gian ngủ (giây)
        </Label>
        <Input
          id={`${config.station_id}-sleep`}
          name="sleep_interval_seconds"
          required
          type="number"
          min={0}
          max={86400}
          value={sleep}
          onChange={(event) => setSleep(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${config.station_id}-mode`}>Chế độ</Label>
        <Select
          id={`${config.station_id}-mode`}
          name="mode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="normal">Bình thường</option>
          <option value="rain_saver">Tiết kiệm mẫu thô</option>
          <option value="maintenance">Bảo trì · không ngủ</option>
        </Select>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Đang lưu…" : "Lưu cấu hình"}
      </Button>
      {result ? (
        <p
          role={result.kind === "success" ? "status" : "alert"}
          className={`text-sm ${result.kind === "success" ? "text-muted" : "text-critical"}`}
        >
          {result.message}
          {result.revision ? ` · r${result.revision}` : ""}
        </p>
      ) : null}
    </form>
  );
}
