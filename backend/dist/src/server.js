"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * RERC Review Portal - Express Server
 *
 * Main entry point that starts the HTTP listener.
 */
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const PORT = process.env.PORT || 3000;
// =============================================================================
// Start Server
// =============================================================================
app_1.default.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
