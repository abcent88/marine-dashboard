const {
  ALLOWED_VESSEL_STATUSES,
  validateVesselId,
  normalizeVesselInput,
  validateVesselInput,
  VESSEL_SELECT,
  serializeVessel
} = require("../vessel-helpers");

describe("vessel-helpers", () => {
  describe("validateVesselId", () => {
    test("returns a positive integer ID", () => {
      expect(validateVesselId("12")).toBe(12);
    });

    test("returns null for invalid IDs", () => {
      expect(validateVesselId("0")).toBeNull();
      expect(validateVesselId("-1")).toBeNull();
      expect(validateVesselId("1.5")).toBeNull();
      expect(validateVesselId("abc")).toBeNull();
    });
  });

  describe("normalizeVesselInput", () => {
    test("normalizes create input and applies create defaults", () => {
      expect(normalizeVesselInput({
        vesselCode: " V001 ",
        name: " Ocean Star ",
        vesselType: " Cargo ",
        flagCountry: " NG ",
        imoNumber: " IMO123 ",
        callSign: " CALL ",
        mmsi: "123456789",
        capacityTons: "1000",
        status: "",
        homePortId: "7",
        commissionedDate: "2026-01-02"
      })).toEqual({
        normalizedCode: "V001",
        normalizedName: "Ocean Star",
        normalizedType: "Cargo",
        normalizedFlagCountry: "NG",
        normalizedImoNumber: "IMO123",
        normalizedCallSign: "CALL",
        normalizedMmsi: "123456789",
        normalizedStatus: "active",
        normalizedHomePortId: 7,
        normalizedCommissionedDate: "2026-01-02",
        normalizedCapacity: 1000
      });
    });

    test("normalizes update input without applying create defaults", () => {
      expect(normalizeVesselInput({
        vesselCode: "V001",
        name: "Ocean Star",
        vesselType: "Cargo",
        capacityTons: "500",
        status: "maintenance"
      }, { requireStatus: true })).toMatchObject({
        normalizedStatus: "maintenance",
        normalizedCapacity: 500,
        normalizedHomePortId: null,
        normalizedCommissionedDate: null
      });
    });
  });

  describe("validateVesselInput", () => {
    const validInput = {
      normalizedCode: "V001",
      normalizedName: "Ocean Star",
      normalizedType: "Cargo",
      normalizedMmsi: "123456789",
      normalizedStatus: "active",
      normalizedCapacity: 1000,
      normalizedHomePortId: null,
      normalizedCommissionedDate: "2026-01-02"
    };

    test("accepts valid vessel input", () => {
      expect(validateVesselInput(validInput)).toBeNull();
    });

    test("rejects missing required fields", () => {
      expect(validateVesselInput({
        ...validInput,
        normalizedName: ""
      })).toBe("vesselCode, name and vesselType are required");
    });

    test("rejects invalid MMSI", () => {
      expect(validateVesselInput({
        ...validInput,
        normalizedMmsi: "123"
      })).toBe("mmsi must be a 9-digit number");
    });

    test("rejects invalid status", () => {
      expect(validateVesselInput({
        ...validInput,
        normalizedStatus: "unknown"
      })).toBe("Invalid vessel status");
    });

    test("rejects invalid capacity", () => {
      expect(validateVesselInput({
        ...validInput,
        normalizedCapacity: -1
      })).toBe("capacityTons must be a non-negative number");
    });

    test("rejects invalid home port ID", () => {
      expect(validateVesselInput({
        ...validInput,
        normalizedHomePortId: 0
      })).toBe("homePortId must be a positive integer");
    });

    test("rejects invalid commissioned date", () => {
      expect(validateVesselInput({
        ...validInput,
        normalizedCommissionedDate: "02-01-2026"
      })).toBe("commissionedDate must use YYYY-MM-DD format");
    });

    test("allows a null MMSI and home port", () => {
      expect(validateVesselInput({
        ...validInput,
        normalizedMmsi: null,
        normalizedHomePortId: null,
        normalizedCommissionedDate: null
      })).toBeNull();
    });
  });

  describe("serializeVessel", () => {
    test("maps database vessel fields to API fields", () => {
      expect(serializeVessel({
        id: "4",
        vessel_code: "V004",
        name: "Ocean Star",
        vessel_type: "Cargo",
        flag_country: "NG",
        imo_number: "IMO123",
        call_sign: "CALL",
        mmsi: "123456789",
        capacity_tons: "1500.50",
        status: "active",
        commissioned_date: "2026-01-02T00:00:00.000Z",
        home_port_id: "7",
        home_port_name: "Lagos Port",
        home_port_country: "Nigeria",
        home_port_code: "NGLOS",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-03T00:00:00.000Z"
      })).toEqual({
        id: 4,
        vesselCode: "V004",
        name: "Ocean Star",
        vesselType: "Cargo",
        flagCountry: "NG",
        imoNumber: "IMO123",
        callSign: "CALL",
        mmsi: "123456789",
        capacityTons: 1500.5,
        status: "active",
        commissionedDate: "2026-01-02",
        homePort: {
          id: 7,
          name: "Lagos Port",
          country: "Nigeria",
          code: "NGLOS"
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z"
      });
    });

    test("returns null home port when none is assigned", () => {
      expect(serializeVessel({
        id: 4,
        vessel_code: "V004",
        name: "Ocean Star",
        vessel_type: "Cargo",
        flag_country: null,
        imo_number: null,
        call_sign: null,
        mmsi: null,
        capacity_tons: "0",
        status: "active",
        commissioned_date: null,
        home_port_id: null,
        home_port_name: null,
        home_port_country: null,
        home_port_code: null,
        created_at: null,
        updated_at: null
      }).homePort).toBeNull();
    });
  });

  test("defines all supported vessel statuses", () => {
    expect(ALLOWED_VESSEL_STATUSES).toEqual([
      "active",
      "restricted",
      "maintenance",
      "out_of_service",
      "retired"
    ]);
  });

  test("shared vessel SELECT includes MMSI and home-port fields", () => {
    expect(VESSEL_SELECT).toContain("v.mmsi");
    expect(VESSEL_SELECT).toContain("p.id AS home_port_id");
    expect(VESSEL_SELECT).toContain("p.code AS home_port_code");
  });
});
