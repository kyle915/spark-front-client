import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  audienceBadgeMeta,
  confidenceBadgeMeta,
  parseTagsInput,
} from "./helpKnowledgeHelpers";
import { routeSparkHelpPrompts } from "@/components/ai/routeAskSparkPrompts";

describe("Spark Help Knowledge Base, Chat AI Assist & Client/Admin Boundaries", () => {
  it("formats audience/confidence badges, parses tags, and differentiates Client vs Admin help prompts", () => {
    expect(audienceBadgeMeta("admin").label).toBe("Admin only");
    expect(audienceBadgeMeta("client").label).toBe("Brand clients");
    expect(audienceBadgeMeta("all").label).toBe("Clients & Admins");

    expect(confidenceBadgeMeta("high").label).toBe("High confidence");
    expect(confidenceBadgeMeta("low").label).toBe("Low confidence");

    expect(parseTagsInput(" pos, matching, pos , csv\nvelocity ")).toEqual([
      "pos",
      "matching",
      "csv",
      "velocity",
    ]);

    const clientPrompts = routeSparkHelpPrompts("/", true).join(" ").toLowerCase();
    const adminPrompts = routeSparkHelpPrompts("/", false).join(" ").toLowerCase();
    expect(clientPrompts).not.toContain("wingspan");
    expect(clientPrompts).not.toContain("payroll");
    expect(adminPrompts).toContain("payroll");

    const demoCostPrompts = routeSparkHelpPrompts("/demo-costs", true).join(" ").toLowerCase();
    expect(demoCostPrompts).toContain("demo costs");
  });

  it("enforces strict AdminOnly access on /help-knowledge and prevents brand clients from adding knowledge", () => {
    const routes = readFileSync(
      resolve(__dirname, "../../../routes/AppRoutes.tsx"),
      "utf8",
    );
    expect(routes).toMatch(
      /path:\s*"\/help-knowledge",\s*component:\s*\(\s*<AdminOnly>\s*<SparkHelpKnowledgePage \/>\s*<\/AdminOnly>\s*\),\s*isPublic:\s*false/,
    );

    const sidebar = readFileSync(
      resolve(__dirname, "../../../layout/SparkSidebar.tsx"),
      "utf8",
    );
    expect(sidebar).toContain('to: "/help-knowledge", adminOnly: true');

    // BrandChatPanel (client Ask Spark) must NEVER expose knowledge-creation UI or admin console links
    const brandChatPanel = readFileSync(
      resolve(__dirname, "../../ai/BrandChatPanel.tsx"),
      "utf8",
    );
    expect(brandChatPanel).toContain("currentPath");
    expect(brandChatPanel).toContain("ReportBrandChatUnhelpfulMutation");
    expect(brandChatPanel).not.toContain("UpsertSparkHelpArticleMutation");
    expect(brandChatPanel).not.toContain("TeachSparkModal");
    expect(brandChatPanel).not.toContain("/help-knowledge");

    // TeachSparkModal & ChatConversation must gate knowledge authoring behind isAdmin
    const teachModal = readFileSync(
      resolve(__dirname, "../../../chat/TeachSparkModal.tsx"),
      "utf8",
    );
    expect(teachModal).toContain("if (!isAdmin) return null");

    const chatConv = readFileSync(
      resolve(__dirname, "../../../chat/ChatConversation.tsx"),
      "utf8",
    );
    expect(chatConv).toContain("DraftChatReplyWithAiMutation");
    expect(chatConv).toContain("mine && isAdmin && m.body");
    expect(chatConv).toContain("TeachSparkModal");
  });
});
