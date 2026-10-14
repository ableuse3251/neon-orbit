import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "http";
import economyRouter from "../routes/economy.js";
import authRouter from "../routes/auth.js";
import { config } from "../config.js";
import { checkNicknameSchema, registerUserSchema } from "../validators.js";

describe("User Registration, Unique Nicknames & Avatars Unit & Route Tests", () => {
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    config.nodeEnv = "test";
    config.devAuthBypass = true;
    config.botToken = "test_bot_token_123";

    app = express();
    app.use(express.json({ limit: "10mb" }));
    app.use("/api", economyRouter);
    app.use("/api", authRouter);
    app.use("/api/auth", authRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("validates nickname format regex rules with Russian, English, digits, spaces, and underscores", () => {
    expect(registerUserSchema.safeParse({ nickname: "Звёздный_Pilot_99" }).success).toBe(true);
    expect(registerUserSchema.safeParse({ nickname: "Ас Космоса" }).success).toBe(true);
    expect(registerUserSchema.safeParse({ nickname: "Space_Ace_01" }).success).toBe(true);

    expect(registerUserSchema.safeParse({ nickname: "A" }).success).toBe(false);
    expect(registerUserSchema.safeParse({ nickname: "WayTooLongNicknameThatExceedsTwentyChars" }).success).toBe(false);
    expect(registerUserSchema.safeParse({ nickname: "Pilot@Space" }).success).toBe(false);
    expect(registerUserSchema.safeParse({ nickname: "Rocket#1" }).success).toBe(false);
  });

  it("checks nickname availability over HTTP API endpoint", async () => {
    const res1 = await fetch(`${baseUrl}/api/user/nickname/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "ЗвёздныйПилот99" }),
    });
    const body1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(body1.available).toBe(true);

    const res2 = await fetch(`${baseUrl}/api/user/nickname/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: "P!lot@#$" }),
    });
    const body2 = await res2.json();
    expect(res2.status).toBe(400);
    expect(body2.available).toBe(false);
  });

  it("registers a user with custom unique nickname and custom photo", async () => {
    const customAvatar = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...";

    const regRes = await fetch(`${baseUrl}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nickname: "Космос_Pilot_77",
        avatarUrl: customAvatar,
      }),
    });
    const regBody = await regRes.json();

    expect(regRes.status).toBe(200);
    expect(regBody.success).toBe(true);
    expect(regBody.username).toBe("Космос_Pilot_77");
    expect(regBody.isRegistered).toBe(true);
    expect(regBody.avatarUrl).toBe(customAvatar);

    const sessionRes = await fetch(`${baseUrl}/api/auth/session`);
    const sessionBody = await sessionRes.json();

    expect(sessionRes.status).toBe(200);
    expect(sessionBody.profile.username).toBe("Космос_Pilot_77");
    expect(sessionBody.profile.isRegistered).toBe(true);
    expect(sessionBody.profile.avatarUrl).toBe(customAvatar);
  });

  it("prevents registering duplicate nicknames across different users (case-insensitive uniqueness)", async () => {
    // 1. User 1001 registers "AlphaPilot"
    const reg1 = await fetch(`${baseUrl}/api/user/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer initDataWithUser1001"
      },
      body: JSON.stringify({ nickname: "AlphaPilot" }),
    });
    expect(reg1.status).toBe(200);

    // 2. User 1002 checks if "alphapilot" is available
    const checkRes = await fetch(`${baseUrl}/api/user/nickname/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer initDataWithUser1002"
      },
      body: JSON.stringify({ nickname: "alphapilot" }),
    });
    const checkBody = await checkRes.json();

    expect(checkRes.status).toBe(200);
    expect(checkBody.available).toBe(false);
    expect(checkBody.reason).toContain("уже занят");
  });

  it("updates custom profile avatar photo via /api/user/avatar endpoint", async () => {
    const newAvatar = "data:image/jpeg;base64,NEW_AVATAR_DATA_STRING";

    const avatarRes = await fetch(`${baseUrl}/api/user/avatar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: newAvatar }),
    });
    const avatarBody = await avatarRes.json();

    expect(avatarRes.status).toBe(200);
    expect(avatarBody.success).toBe(true);
    expect(avatarBody.avatarUrl).toBe(newAvatar);
  });
});
