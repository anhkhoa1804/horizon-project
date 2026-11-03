// Generates THROWAWAY local-only secrets/JWTs for the isolated stack. Never reuse production values.
import { createHmac, randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
const out = new URL("./.env.local-stack", import.meta.url);
if (existsSync(out)) { console.log("exists, keeping"); process.exit(0); }
const secret = randomBytes(24).toString("hex");
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role) => { const h = b({alg:"HS256",typ:"JWT"}); const p = b({role,iss:"local-stack",iat:1700000000,exp:4102444800}); return `${h}.${p}.${createHmac("sha256",secret).update(`${h}.${p}`).digest("base64url")}`; };
writeFileSync(out, [
`JWT_SECRET=${secret}`,`ANON_KEY=${jwt("anon")}`,`SERVICE_ROLE_KEY=${jwt("service_role")}`,
`POSTGRES_PASSWORD=${randomBytes(12).toString("hex")}`,
`ADMIN_PASSWORD=local-admin-${randomBytes(6).toString("hex")}`,
`ADMIN_SESSION_SECRET=${randomBytes(24).toString("hex")}`,`GATEWAY_INGEST_TOKEN=local-gw-${randomBytes(16).toString("hex")}`,""].join("\n"));
console.log("written");
