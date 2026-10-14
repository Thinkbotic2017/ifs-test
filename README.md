# IFS → SITS Oracle Query Tester

A local Node.js web app for testing Q0–Q6 read-only polling queries against an Oracle Database.

## Requirements
- Node.js 20 or newer
- Network access to the approved Oracle database (LAN/VPN as required)
- Oracle service name, hostname/IP, port, username and password from your DBA

## Setup (Windows PowerShell)
```powershell
cd ifs-sits-query-tester
npm install
Copy-Item .env.example .env
notepad .env
npm start
```

Set `IFS_USER`, `IFS_PASSWORD`, and `IFS_CONNECT_STRING` in `.env`. The connect string format is commonly `hostname:1521/service_name`; use the exact details provided by your DBA. Never commit or share `.env`.

Open http://127.0.0.1:3100, click **Test connection**, then **Run all queries**.

## Oracle conversion notes
- Uses the official `oracledb` Node.js driver and Oracle Thin mode by default (Oracle Client libraries generally are not required).
- Q0 shows direct object/system privileges for the current account; it is not a complete security audit. Ask DBA to review role-inherited privileges.
- Q1 uses named binds and Oracle row limiting (`FETCH FIRST`, Oracle 12c+).
- Q4–Q6 build named binds for each part number; values are never concatenated into SQL.
- Query names, tables and columns were carried over from the supplied query file. Confirm the actual IFS schema, owner, object names and column names with your DBA before relying on results. The sample gate-entry/part values are placeholders.
- This is a query tester, not the full SITS poller. It does not write to IFS or SITS.

## Troubleshooting
- `ORA-12154`: verify service name/connect string.
- `ORA-12514`: listener does not know the requested service; ask DBA for the correct service name.
- `ORA-01017`: username/password invalid.
- `ORA-00942` / `ORA-00904`: object or column name does not exist or the account cannot access it; verify IFS schema and grants.
- Network test fails: verify LAN/VPN, firewall and listener port with IT.
