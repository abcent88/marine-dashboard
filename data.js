window.MOCK = {
  header: {
    salesMonth: 25798000,     // $25.798M
    performance: 85.9,        // %
    port: "Dutch Harbor",
    tempF: 55
  },
  ships: {
    active: 15,
    total: 18,
    totalCapacityTons: 1500,
    usedCapacityTons: 1200,   // 80%
    status: {
      practicable: 12,
      restricted: 3,
      outOfService: 2
    }
  },
  bothShips: {
    capacityPct: 60,
    recoveryPct: 75
  },
  ai: {
    fishName: "Pacific Mackerel",
    meta: "Ocean-caught • Coral Sea",
    marketShare: 28,
    annualTons: 580,
    sustainabilityScore: 82
  },
  capture: {
    trendPct: 7.0,
    nowLb: 28500,
    targetLb: 30000,
    byType: {
      mackerel: [
        { label: "Pacific Mackerel", valueLb: 12000 },
        { label: "Sardine", valueLb: 10000 },
        { label: "Others", valueLb: 6500 }
      ],
      salmon: [
        { label: "Coho Salmon", valueLb: 10500 },
        { label: "Sockeye", valueLb: 9200 },
        { label: "Others", valueLb: 8800 }
      ],
      others: [
        { label: "Herring", valueLb: 8600 },
        { label: "Cod", valueLb: 7900 },
        { label: "Others", valueLb: 13500 }
      ]
    }
  },
  captains: {
    zones: ["Coral Sea", "Arafura Sea", "Bering Sea", "North Pacific"],
    list: [
      { name: "John Morrison", shift: "day", zone: "Coral Sea", status: "Active", nav: true, util: 80 },
      { name: "Captain Nemo", shift: "night", zone: "Arafura Sea", status: "Active", nav: true, util: 70 },
      { name: "Ava Shore", shift: "day", zone: "Bering Sea", status: "Limited", nav: false, util: 55 },
      { name: "Kai Redding", shift: "night", zone: "North Pacific", status: "Active", nav: true, util: 76 }
    ]
  },
  radar: {
    zoneTitle: "Pacific",
    ocean: "Coral Sea",
    annual: "580K tons",
    ships: [
      { x: 120, y: 90, label: "S-12" },
      { x: 320, y: 140, label: "S-07" },
      { x: 430, y: 70, label: "S-03" }
    ],
    route: [
      { x: 80, y: 160 }, { x: 160, y: 120 }, { x: 240, y: 140 },
      { x: 320, y: 110 }, { x: 420, y: 90 }
    ]
  }
};