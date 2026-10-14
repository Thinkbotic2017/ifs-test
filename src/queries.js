// Oracle-compatible versions of the Q0-Q6 read-only diagnostic queries.
// Confirm actual IFS schema/table/column names with the DBA before production use.
const queries = [
  {
    id: "Q0",
    name: "Oracle account privileges",
    description: "Diagnostic only: lists direct object and system privileges for the connected Oracle user. Ask the DBA to verify inherited role grants too.",
    sql: `SELECT 'OBJECT' AS "grantType", PRIVILEGE AS "privilege", TABLE_NAME AS "objectName"
FROM USER_TAB_PRIVS
UNION ALL
SELECT 'SYSTEM' AS "grantType", PRIVILEGE AS "privilege", CAST(NULL AS VARCHAR2(128)) AS "objectName"
FROM USER_SYS_PRIVS
ORDER BY 1, 2`,
    params: [], kind: "grants"
  },
  {
    id: "Q1",
    name: "New gate entries after watermark",
    description: "Main-poll query. Uses Oracle named binds and a 25-entry sample batch.",
    sql: `SELECT GATE_ENTRY_NO AS "gateEntryNo", VENDOR_NO AS "vendorNo",
       GATE_ENTRY_DATE AS "gateEntryDate", PREFIX AS "prefix"
FROM gate_entry_header
WHERE GATE_ENTRY_DATE >= :watermarkDate
  AND (GATE_ENTRY_DATE > :watermarkDate
    OR (GATE_ENTRY_DATE = :watermarkDate AND GATE_ENTRY_NO > :watermarkCursor))
ORDER BY GATE_ENTRY_DATE ASC, GATE_ENTRY_NO ASC
FETCH FIRST :rowLimit ROWS ONLY`,
    params: ["2026-10-01 00:00:00", "GE-0001", 25], kind: "entries"
  },
  {
    id: "Q2", name: "One gate-entry header",
    description: "Fetch the header for the selected gate-entry number.",
    sql: `SELECT GATE_ENTRY_NO AS "gateEntryNo", VENDOR_NO AS "vendorNo",
       GATE_ENTRY_DATE AS "gateEntryDate", PREFIX AS "prefix"
FROM gate_entry_header
WHERE GATE_ENTRY_NO = :gateEntryNo
FETCH FIRST 1 ROW ONLY`,
    params: ["GE-0002"], kind: "header"
  },
  {
    id: "Q3", name: "Gate-entry lines",
    description: "Line details for the selected gate-entry number.",
    sql: `SELECT id AS "id", GATE_ENTRY_NO AS "gateEntryNo", PART_NO AS "partNo",
       CHALLAN_QTY AS "challanQty", RECEIVED_QTY AS "receivedQty",
       ACCEPTED_QTY AS "acceptedQty", DESCRIPTION AS "description",
       UNIT_MEAS AS "unitMeas", STATUS AS "status", HOLD AS "hold",
       CHARGES_APPROVED AS "chargesApproved", NOTE_TEXT AS "noteText",
       CONVERSION_FACTOR AS "conversionFactor", INVENTORY_QTY AS "inventoryQty"
FROM gate_entry_details
WHERE GATE_ENTRY_NO = :gateEntryNo
ORDER BY id ASC`,
    params: ["GE-0002"], kind: "lines"
  },
  {
    id: "Q4", name: "Part catalog",
    description: "Part metadata for distinct PART_NO values returned by Q3.",
    sql: `SELECT PART_NO AS "partNo", DESCRIPTION AS "description",
       SERIAL_RULE AS "serialRule", SERIAL_TRACKING_CODE AS "serialTrackingCode"
FROM part_catalog
WHERE PART_NO IN (:part0, :part1)`,
    params: [["PART-A", "PART-B"]], kind: "parts"
  },
  {
    id: "Q5", name: "Inventory part",
    description: "Item master data; normally run for new/changed entries.",
    sql: `SELECT id AS "id", PART_NO AS "partNo", UNIT_MEAS AS "unitMeas",
       DESCRIPTION AS "description", WEIGHT_NET AS "weightNet"
FROM inventory_part
WHERE PART_NO IN (:part0, :part1)`,
    params: [["PART-A", "PART-B"]], kind: "inventory"
  },
  {
    id: "Q6", name: "Part locations",
    description: "Part locations and warehouses; normally run for new/changed entries.",
    sql: `SELECT id AS "id", PART_NO AS "partNo", LOCATION_NO AS "locationNo", WAREHOUSE AS "warehouse"
FROM inventory_part_location
WHERE PART_NO IN (:part0, :part1)
ORDER BY PART_NO ASC, LOCATION_NO ASC`,
    params: [["PART-A", "PART-B"]], kind: "locations"
  }
];
module.exports = queries;
