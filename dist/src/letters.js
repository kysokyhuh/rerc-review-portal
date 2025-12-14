"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildInitialAckLetter = buildInitialAckLetter;
exports.buildInitialApprovalLetter = buildInitialApprovalLetter;
const docx_1 = require("docx");
const prisma_1 = __importDefault(require("./prisma"));
async function fetchSubmission(submissionId) {
    return prisma_1.default.submission.findUnique({
        where: { id: submissionId },
        include: {
            project: {
                include: {
                    committee: true,
                    createdBy: true,
                },
            },
            classification: true,
        },
    });
}
function formatDate(value) {
    if (!value)
        return "";
    return new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
async function buildInitialAckLetter(submissionId) {
    const submission = await fetchSubmission(submissionId);
    if (!submission || !submission.project || !submission.project.committee) {
        throw new Error("Submission not found");
    }
    const project = submission.project;
    const committee = project.committee;
    const classification = submission.classification;
    const ra = project.createdBy;
    const doc = new docx_1.Document({
        sections: [
            {
                children: [
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({
                                text: committee.name,
                                bold: true,
                            }),
                        ],
                    }),
                    new docx_1.Paragraph(formatDate(submission.receivedDate) || formatDate(new Date())),
                    new docx_1.Paragraph(""),
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({ text: project.piName, break: 1 }),
                            new docx_1.TextRun({
                                text: project.piAffiliation ?? "",
                                break: 1,
                            }),
                        ],
                    }),
                    new docx_1.Paragraph(""),
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({
                                text: "Subject: Acknowledgement of Initial Submission",
                                bold: true,
                            }),
                        ],
                    }),
                    new docx_1.Paragraph(""),
                    new docx_1.Paragraph(`Dear ${project.piName}, this letter acknowledges receipt of protocol ${project.projectCode} - "${project.title}".`),
                    new docx_1.Paragraph(`The submission was received on ${formatDate(submission.receivedDate)} and classified as ${classification?.reviewType ?? "TBD"}.`),
                    new docx_1.Paragraph({
                        text: "Our office will contact you if additional documents are required.",
                    }),
                    new docx_1.Paragraph(""),
                    new docx_1.Paragraph("Sincerely,"),
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({ text: ra?.fullName ?? "Research Associate", break: 1 }),
                            new docx_1.TextRun("Research Associate"),
                            new docx_1.TextRun({ text: `\n${committee.name}` }),
                        ],
                    }),
                ],
            },
        ],
    });
    return docx_1.Packer.toBuffer(doc);
}
async function buildInitialApprovalLetter(submissionId) {
    const submission = await fetchSubmission(submissionId);
    if (!submission || !submission.project || !submission.project.committee) {
        throw new Error("Submission not found");
    }
    const project = submission.project;
    const committee = project.committee;
    const classification = submission.classification;
    const ra = project.createdBy;
    const doc = new docx_1.Document({
        sections: [
            {
                children: [
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({ text: committee.name, bold: true }),
                        ],
                    }),
                    new docx_1.Paragraph(formatDate(submission.finalDecisionDate) || formatDate(new Date())),
                    new docx_1.Paragraph(""),
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({ text: project.piName, break: 1 }),
                            new docx_1.TextRun({
                                text: project.piAffiliation ?? "",
                                break: 1,
                            }),
                        ],
                    }),
                    new docx_1.Paragraph(""),
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({
                                text: "Subject: Initial Approval Notification",
                                bold: true,
                            }),
                        ],
                    }),
                    new docx_1.Paragraph(""),
                    new docx_1.Paragraph(`Dear ${project.piName}, the RERC has approved protocol ${project.projectCode} - "${project.title}".`),
                    new docx_1.Paragraph(`Review Type: ${classification?.reviewType ?? "TBD"}; Decision: ${submission.finalDecision ?? "APPROVED"}.`),
                    new docx_1.Paragraph(`Approval validity: ${formatDate(project.approvalStartDate)} to ${formatDate(project.approvalEndDate)}.`),
                    new docx_1.Paragraph("Please ensure adherence to the approved protocol."),
                    new docx_1.Paragraph(""),
                    new docx_1.Paragraph("Sincerely,"),
                    new docx_1.Paragraph({
                        children: [
                            new docx_1.TextRun({ text: ra?.fullName ?? "Research Associate", break: 1 }),
                            new docx_1.TextRun("Research Associate"),
                            new docx_1.TextRun({ text: `\n${committee.name}` }),
                        ],
                    }),
                ],
            },
        ],
    });
    return docx_1.Packer.toBuffer(doc);
}
