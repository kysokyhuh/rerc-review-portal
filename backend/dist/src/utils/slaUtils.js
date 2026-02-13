"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workingDaysBetween = workingDaysBetween;
const workingDays_1 = require("./workingDays");
function workingDaysBetween(start, end, holidays = []) {
    return (0, workingDays_1.computeWorkingDaysBetween)(start, end, holidays);
}
