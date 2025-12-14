import { Document, Packer, Paragraph, TextRun } from "docx";
import prisma from "./prisma";

async function fetchSubmission(submissionId: number) {
  return prisma.submission.findUnique({
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

function formatDate(value?: Date | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function buildInitialAckLetter(submissionId: number) {
  const submission = await fetchSubmission(submissionId);
  if (!submission || !submission.project || !submission.project.committee) {
    throw new Error("Submission not found");
  }

  const project = submission.project;
  const committee = project.committee;
  const classification = submission.classification;
  const ra = project.createdBy;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: committee.name,
                bold: true,
              }),
            ],
          }),
          new Paragraph(formatDate(submission.receivedDate) || formatDate(new Date())),
          new Paragraph(""),
          new Paragraph({
            children: [
              new TextRun({ text: project.piName, break: 1 }),
              new TextRun({
                text: project.piAffiliation ?? "",
                break: 1,
              }),
            ],
          }),
          new Paragraph(""),
          new Paragraph({
            children: [
              new TextRun({
                text: "Subject: Acknowledgement of Initial Submission",
                bold: true,
              }),
            ],
          }),
          new Paragraph(""),
          new Paragraph(
            `Dear ${project.piName}, this letter acknowledges receipt of protocol ${project.projectCode} - "${project.title}".`,
          ),
          new Paragraph(
            `The submission was received on ${formatDate(
              submission.receivedDate,
            )} and classified as ${classification?.reviewType ?? "TBD"}.`,
          ),
          new Paragraph({
            text:
              "Our office will contact you if additional documents are required.",
          }),
          new Paragraph(""),
          new Paragraph("Sincerely,"),
          new Paragraph({
            children: [
              new TextRun({ text: ra?.fullName ?? "Research Associate", break: 1 }),
              new TextRun("Research Associate"),
              new TextRun({ text: `\n${committee.name}` }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function buildInitialApprovalLetter(submissionId: number) {
  const submission = await fetchSubmission(submissionId);
  if (!submission || !submission.project || !submission.project.committee) {
    throw new Error("Submission not found");
  }

  const project = submission.project;
  const committee = project.committee;
  const classification = submission.classification;
  const ra = project.createdBy;

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: committee.name, bold: true }),
            ],
          }),
          new Paragraph(formatDate(submission.finalDecisionDate) || formatDate(new Date())),
          new Paragraph(""),
          new Paragraph({
            children: [
              new TextRun({ text: project.piName, break: 1 }),
              new TextRun({
                text: project.piAffiliation ?? "",
                break: 1,
              }),
            ],
          }),
          new Paragraph(""),
          new Paragraph({
            children: [
              new TextRun({
                text: "Subject: Initial Approval Notification",
                bold: true,
              }),
            ],
          }),
          new Paragraph(""),
          new Paragraph(
            `Dear ${project.piName}, the RERC has approved protocol ${project.projectCode} - "${project.title}".`,
          ),
          new Paragraph(
            `Review Type: ${classification?.reviewType ?? "TBD"}; Decision: ${submission.finalDecision ?? "APPROVED"}.`,
          ),
          new Paragraph(
            `Approval validity: ${formatDate(
              project.approvalStartDate,
            )} to ${formatDate(project.approvalEndDate)}.`,
          ),
          new Paragraph("Please ensure adherence to the approved protocol."),
          new Paragraph(""),
          new Paragraph("Sincerely,"),
          new Paragraph({
            children: [
              new TextRun({ text: ra?.fullName ?? "Research Associate", break: 1 }),
              new TextRun("Research Associate"),
              new TextRun({ text: `\n${committee.name}` }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
