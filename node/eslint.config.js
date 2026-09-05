const globals = require("globals");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "coverage/**"
    ]
  },
  {
    files: ["public/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser
      }
    },
    rules: {
        "no-unused-vars": ["warn", {
          "varsIgnorePattern": "^loadVoyages$"
        }],
      "no-undef": "error",
      "no-unreachable": "error"
    }
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
        $: "readonly",
        API_BASE: "readonly",
        escapeHtml: "readonly",
        loadVoyages: "readonly",
        loadVessels: "readonly",
        loadDashboardSummary: "readonly",
        loadCrew: "readonly",
        loadCatch: "readonly",
        loadAlerts: "readonly",
        LIVE: "readonly",
        nowTime: "readonly",
        formatVoyageDate: "readonly",
        pct: "readonly",
        capacityChart: "writable",
        makeDoughnut: "readonly",
        openEditVesselModal: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", {
        "varsIgnorePattern": "^(loadVoyages|loadVessels|loadDashboardSummary|loadCrew|loadCatch|loadAlerts|loadMaintenance)$"
      }],
      "no-undef": "error",
      "no-unreachable": "error"
    }
  }
];
