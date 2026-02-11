"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRoutes = exports.importRoutes = exports.mailMergeRoutes = exports.submissionRoutes = exports.projectRoutes = exports.dashboardRoutes = exports.committeeRoutes = exports.healthRoutes = void 0;
// Barrel exports for routes
var healthRoutes_1 = require("./healthRoutes");
Object.defineProperty(exports, "healthRoutes", { enumerable: true, get: function () { return __importDefault(healthRoutes_1).default; } });
var committeeRoutes_1 = require("./committeeRoutes");
Object.defineProperty(exports, "committeeRoutes", { enumerable: true, get: function () { return __importDefault(committeeRoutes_1).default; } });
var dashboardRoutes_1 = require("./dashboardRoutes");
Object.defineProperty(exports, "dashboardRoutes", { enumerable: true, get: function () { return __importDefault(dashboardRoutes_1).default; } });
var projectRoutes_1 = require("./projectRoutes");
Object.defineProperty(exports, "projectRoutes", { enumerable: true, get: function () { return __importDefault(projectRoutes_1).default; } });
var submissionRoutes_1 = require("./submissionRoutes");
Object.defineProperty(exports, "submissionRoutes", { enumerable: true, get: function () { return __importDefault(submissionRoutes_1).default; } });
var mailMergeRoutes_1 = require("./mailMergeRoutes");
Object.defineProperty(exports, "mailMergeRoutes", { enumerable: true, get: function () { return __importDefault(mailMergeRoutes_1).default; } });
var importRoutes_1 = require("./importRoutes");
Object.defineProperty(exports, "importRoutes", { enumerable: true, get: function () { return __importDefault(importRoutes_1).default; } });
var reportRoutes_1 = require("./reportRoutes");
Object.defineProperty(exports, "reportRoutes", { enumerable: true, get: function () { return __importDefault(reportRoutes_1).default; } });
