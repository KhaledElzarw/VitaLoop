import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "../src/App";
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

  it("renders mocked reminders on the reminder screen", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Reminders" }));

    for (const reminder of reminders) {
      expect(
        screen.getByRole("heading", { name: reminder.title }),
      ).toBeTruthy();
    }
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
