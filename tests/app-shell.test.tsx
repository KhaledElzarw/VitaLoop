import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App, { HomeScreen, RemindersScreen } from "../src/App";
import { reminders } from "../src/data/reminders";

afterEach(cleanup);

describe("VitaLoop app shell", () => {
  it("renders VitaLoop branding", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "VitaLoop" })).toBeTruthy();
    expect(
      screen.getByText("Recurring wellness reminders for busy days."),
    ).toBeTruthy();
  });

  it("renders primary navigation labels", () => {
    render(<App />);

    const navigation = screen.getByRole("navigation", { name: "Primary" });

    for (const label of [
      "Home",
      "Reminders",
      "Settings",
      "Backlog",
      "Watch Preview",
      "About",
    ]) {
      expect(within(navigation).getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("renders reminder cards for all expected categories", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));

    const reminderCategories = screen.getByLabelText("Reminder categories");

    for (const reminder of reminders) {
      expect(
        within(reminderCategories).getByRole("heading", {
          name: reminder.title,
        }),
      ).toBeTruthy();
    }
  });

  it("shows the next wellness nudge on the home screen", () => {
    render(<HomeScreen reminders={reminders} />);

    expect(screen.getByLabelText("Next wellness nudge")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Hydration" })).toBeTruthy();
    expect(screen.getByText("Every 90 minutes")).toBeTruthy();
  });

  it("shows selected reminder details", () => {
    render(<RemindersScreen reminders={reminders} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Show Eye strain details/i }),
    );

    const details = screen.getByRole("region", {
      name: "Selected reminder details",
    });

    expect(
      within(details).getByRole("heading", { name: "Eye strain" }),
    ).toBeTruthy();
    expect(within(details).getByText("Screen breaks")).toBeTruthy();
    expect(
      within(details).getByText(
        "Next reminder preview: Eye strain follows the every 45 minutes rhythm.",
      ),
    ).toBeTruthy();
  });

  it("renders an empty reminders state", () => {
    render(<RemindersScreen reminders={[]} />);

    expect(screen.getByText("No reminders to show")).toBeTruthy();
  });

  it("renders a reminders error state", () => {
    render(<RemindersScreen reminders={reminders} hasError />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Reminders are unavailable")).toBeTruthy();
  });

  it("renders core backlog categories", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Backlog" }));

    for (const category of [
      "P0 Foundation",
      "P0 Core Screens",
      "P0 Reminder Categories",
      "P1 Settings",
      "P2 Mobile Packaging",
      "P2 Apple Watch",
    ]) {
      expect(screen.getByText(category)).toBeTruthy();
    }
  });
});
