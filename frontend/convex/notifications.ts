"use node";

import { actionGeneric } from "convex/server";
import { v } from "convex/values";
import { Resend } from "resend";

export const send = actionGeneric({
  args: {
    email: v.string(),
    projectName: v.string(),
    riskScore: v.number(),
    riskLevel: v.string(),
    conflictCount: v.number(),
    lat: v.number(),
    lng: v.number(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set — skipping email notification.");
      return { success: false };
    }

    const resend = new Resend(apiKey);

    const riskColor =
      args.riskLevel === "critical" || args.riskLevel === "high"
        ? "#EF4444"
        : args.riskLevel === "medium"
          ? "#F59E0B"
          : "#10B981";

    const html = `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 520px; margin: 0 auto; background: #0A1628; padding: 32px; border-radius: 12px; color: #E2E8F0;">
        <h2 style="margin: 0 0 4px; color: #14B8A6; font-size: 20px;">BlueDocs</h2>
        <p style="margin: 0 0 24px; color: #64748B; font-size: 12px;">Conflict Analysis Report</p>

        <div style="background: #1E293B; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">${args.projectName}</p>
          <p style="margin: 0 0 4px; color: #94A3B8; font-size: 13px;">
            ${args.lat.toFixed(4)}°N, ${Math.abs(args.lng).toFixed(4)}°${args.lng < 0 ? "W" : "E"}
          </p>
        </div>

        <div style="background: #1E293B; border-radius: 8px; padding: 20px; margin-bottom: 16px; text-align: center;">
          <p style="margin: 0 0 8px; color: #94A3B8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Risk Score</p>
          <p style="margin: 0 0 8px; font-size: 36px; font-weight: 700; color: ${riskColor};">${Math.round(args.riskScore)}<span style="font-size: 16px; color: #64748B;">/100</span></p>
          <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: ${riskColor}20; color: ${riskColor};">
            ${args.riskLevel}
          </span>
        </div>

        <div style="background: #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="margin: 0; color: #94A3B8; font-size: 13px;">
            <strong style="color: #E2E8F0;">${args.conflictCount}</strong> spatial conflict${args.conflictCount !== 1 ? "s" : ""} detected
          </p>
        </div>

        <p style="margin: 0; color: #475569; font-size: 11px; text-align: center;">
          Sent by BlueDocs · Spatial Intelligence for the Blue Economy
        </p>
      </div>
    `;

    try {
      await resend.emails.send({
        from: "BlueDocs <onboarding@resend.dev>",
        to: args.email,
        subject: `${args.projectName} — Risk ${args.riskLevel.toUpperCase()} (${Math.round(args.riskScore)}/100)`,
        html,
      });
      return { success: true };
    } catch (error) {
      console.error("Failed to send notification email:", error);
      return { success: false };
    }
  },
});
