import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatisticsModal } from "./StatisticsModal";
import { AchievementsModal } from "./AchievementsModal";
import { NavShortcuts } from "../NavShortcuts";

vi.mock("../../utils/audio", () => ({ playSound: vi.fn() }));
vi.mock("../account/NotificationsBell", () => ({ NotificationsBell: () => null }));

afterEach(cleanup);

describe("StatisticsModal", () => {
  it("renders Today daily goal and course progress when open", () => {
    render(
      <StatisticsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={{
          source: "recorded",
          updatedAt: null,
          dayStreak: 5,
          longestStreak: 10,
          totalXp: 120,
          level: 2,
          starsEarned: 14,
          lessonsMastered: 8,
          lessonsAvailable: 284,
          dailyGoal: 4,
          dailySolved: 2,
          topThreeFinishes: 1,
          league: "Bronze",
          badges: [],
          childrenCount: 0,
          codesWaiting: 0,
          permissionsCount: 0,
        }}
      />
    );

    expect(screen.getByText("Statistics")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Daily goal")).toBeTruthy();
    expect(screen.getByText("2 / 4")).toBeTruthy();
    expect(screen.getByText("Course progress")).toBeTruthy();
    expect(screen.getByText("8 / 284")).toBeTruthy();
    expect(screen.getByText("120 XP")).toBeTruthy();
  });
});

describe("AchievementsModal", () => {
  it("renders badge shelf when open", () => {
    render(
      <AchievementsModal
        isOpen={true}
        onClose={vi.fn()}
        stats={{
          source: "recorded",
          updatedAt: null,
          dayStreak: 1,
          longestStreak: 2,
          totalXp: 80,
          level: 1,
          starsEarned: 6,
          lessonsMastered: 2,
          lessonsAvailable: 284,
          dailyGoal: 4,
          dailySolved: 0,
          topThreeFinishes: 0,
          league: null,
          badges: [],
          childrenCount: 0,
          codesWaiting: 0,
          permissionsCount: 0,
        }}
      />
    );

    expect(screen.getAllByText("Achievements").length).toBeGreaterThan(0);
    expect(screen.getByText("Won, and the next one to go for")).toBeTruthy();
    // At 80 XP, "First Steps" (50 XP threshold) is earned
    expect(screen.getByText("First Steps")).toBeTruthy();
  });
});

describe("NavShortcuts with Statistics and Achievements", () => {
  it("renders Profile, Statistics, and Achievements tiles", () => {
    render(<NavShortcuts activeTab="settings" onSelectTab={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Profile" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Statistics" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Achievements" })).toBeTruthy();
  });

  it("opens Statistics modal when Statistics tile is clicked", () => {
    render(<NavShortcuts activeTab="settings" onSelectTab={vi.fn()} />);

    expect(screen.queryByText("Today")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Statistics" }));
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("opens Achievements modal when Achievements tile is clicked", () => {
    render(<NavShortcuts activeTab="settings" onSelectTab={vi.fn()} />);

    expect(screen.queryByText("Won, and the next one to go for")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Achievements" }));
    expect(screen.getByText("Won, and the next one to go for")).toBeTruthy();
  });
});
