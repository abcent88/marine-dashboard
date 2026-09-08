const ALLOWED_VESSEL_STATUSES = [
  "active",
  "restricted",
  "maintenance",
  "out_of_service",
  "retired"
];

function validateVesselId(value) {
  const vesselId = Number(value);

  if(!Number.isInteger(vesselId) || vesselId <= 0){
    return null;
  }

  return vesselId;
}

function normalizeVesselInput(body = {}, { mode = "create" } = {}) {
  const {
    vesselCode,
    name,
    vesselType,
    flagCountry,
    imoNumber,
    callSign,
    mmsi,
    capacityTons,
    status,
    homePortId,
    commissionedDate
  } = body;

  const normalizedCode = String(vesselCode || "").trim();
  const normalizedName = String(name || "").trim();
  const normalizedType = String(vesselType || "").trim();

  const normalizeOptionalString = value =>
    value == null ? null : String(value).trim() || null;

  const normalizedFlagCountry = normalizeOptionalString(flagCountry);
  const normalizedImoNumber = normalizeOptionalString(imoNumber);
  const normalizedCallSign = normalizeOptionalString(callSign);
  const normalizedMmsi = normalizeOptionalString(mmsi);

  const normalizedStatus = mode === "update"
    ? String(status || "").trim()
    : String(status || "active").trim();

  const normalizedHomePortId = mode === "create"
    ? (homePortId == null || String(homePortId).trim() === "" ? null : Number(homePortId))
    : (homePortId == null || homePortId === "" ? null : Number(homePortId));

  const normalizedCommissionedDate = mode === "create"
    ? (commissionedDate ? String(commissionedDate).trim() : null)
    : (commissionedDate == null || commissionedDate === "" ? null : String(commissionedDate).trim());

  const normalizedCapacity = mode === "update"
    ? Number(capacityTons)
    : Number(capacityTons ?? 0);

  return {
    normalizedCode,
    normalizedName,
    normalizedType,
    normalizedFlagCountry,
    normalizedImoNumber,
    normalizedCallSign,
    normalizedMmsi,
    normalizedStatus,
    normalizedHomePortId,
    normalizedCommissionedDate,
    normalizedCapacity
  };
}

function validateVesselInput(input) {
  const {
    normalizedCode,
    normalizedName,
    normalizedType,
    normalizedMmsi,
    normalizedStatus,
    normalizedCapacity,
    normalizedHomePortId,
    normalizedCommissionedDate
  } = input;

  if(!normalizedCode || !normalizedName || !normalizedType){
    return "vesselCode, name and vesselType are required";
  }

  if(normalizedMmsi && !/^\d{9}$/.test(normalizedMmsi)){
    return "mmsi must be a 9-digit number";
  }

  if(!ALLOWED_VESSEL_STATUSES.includes(normalizedStatus)){
    return "Invalid vessel status";
  }

  if(!Number.isFinite(normalizedCapacity) || normalizedCapacity < 0){
    return "capacityTons must be a non-negative number";
  }

  if(normalizedHomePortId !== null &&
     (!Number.isInteger(normalizedHomePortId) || normalizedHomePortId <= 0)){
    return "homePortId must be a positive integer";
  }

  if(normalizedCommissionedDate &&
     !/^\d{4}-\d{2}-\d{2}$/.test(normalizedCommissionedDate)){
    return "commissionedDate must use YYYY-MM-DD format";
  }

  return null;
}

const VESSEL_SELECT = `
  SELECT
    v.id,
    v.vessel_code,
    v.name,
    v.vessel_type,
    v.flag_country,
    v.imo_number,
    v.call_sign,
    v.mmsi,
    v.capacity_tons,
    v.status,
    DATE_FORMAT(v.commissioned_date, '%Y-%m-%d') AS commissioned_date,
    v.created_at,
    v.updated_at,
    p.id AS home_port_id,
    p.name AS home_port_name,
    p.country AS home_port_country,
    p.code AS home_port_code
  FROM vessels v
  LEFT JOIN ports p
    ON p.id = v.home_port_id
`;

function serializeVessel(vessel) {
  return {
    id: Number(vessel.id),
    vesselCode: vessel.vessel_code,
    name: vessel.name,
    vesselType: vessel.vessel_type,
    flagCountry: vessel.flag_country,
    imoNumber: vessel.imo_number,
    callSign: vessel.call_sign,
    mmsi: vessel.mmsi,
    capacityTons: Number(vessel.capacity_tons),
    status: vessel.status,
    commissionedDate: vessel.commissioned_date
      ? String(vessel.commissioned_date).slice(0, 10)
      : null,
    homePort: vessel.home_port_id
      ? {
          id: Number(vessel.home_port_id),
          name: vessel.home_port_name,
          country: vessel.home_port_country,
          code: vessel.home_port_code
        }
      : null,
    createdAt: vessel.created_at,
    updatedAt: vessel.updated_at
  };
}

module.exports = {
  ALLOWED_VESSEL_STATUSES,
  validateVesselId,
  normalizeVesselInput,
  validateVesselInput,
  VESSEL_SELECT,
  serializeVessel
};
