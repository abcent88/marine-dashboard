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
        ...globals.browser,
        currentDashboardUser: "readonly",
        canManageUsers: "readonly",
        USER_ROLES: "readonly",
        USER_STATUSES: "readonly",
        LIVE_USERS: "writable",
        loadUsers: "readonly",
        loadVesselDetails: "readonly",
        closeVesselDetails: "readonly",
        bindVesselRowClicks: "readonly",
        applyLiveVessels: "readonly"
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
      moneyShort: "readonly",
      Chart: "readonly",
      sustainChart: "writable",
      applyLiveSummary: "readonly",
        loadVoyages: "readonly",
        loadVessels: "readonly",
        loadDashboardSummary: "readonly",
        loadCrew: "readonly",
        loadCatch: "readonly",
        loadAlerts: "readonly",
        loadReports: "readonly",
        initVesselManagement: "readonly",
        initUserManagement: "readonly",
        initEditUserManagement: "readonly",
        LIVE: "readonly",
        nowTime: "readonly",
        formatVoyageDate: "readonly",
        pct: "readonly",
        capacityChart: "writable",
        makeDoughnut: "readonly",
        openEditVesselModal: "readonly",
        openVesselManagementModalImpl: "readonly",
        openEditVesselModalImpl: "readonly",
        setCatchInsight: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", {
        "varsIgnorePattern": "^(loadVoyages|loadVessels|loadVesselDetails|closeVesselDetails|bindVesselRowClicks|applyLiveVessels|loadDashboardSummary|loadCrew|loadCatch|loadAlerts|loadMaintenance|loadFuel|loadReports|initVesselManagement|initUserManagement|initEditUserManagement|setHeader|makeDoughnut|setShips|setBothShips|setAI|setCapture|setCaptains|setRadar|setCatchInsight|wireCaptureTabs|openEditVesselModal|openVesselManagementModalImpl|openEditVesselModalImpl|USER_ROLES|USER_STATUSES|loadUsers)$"
      }],
      "no-undef": "error",
      "no-unreachable": "error"
    }
  }
];
