// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageLoader } from "@/components/page-loader";
import { Loader } from "@/components/ui/loader";

describe("orbit-ring page loader", () => {
  it("PageLoader exposes a labelled status region with the curve svg", () => {
    render(<PageLoader label="Loading skills" />);

    const status = screen.getByRole("status", { name: "Loading skills" });
    expect(status.querySelector("svg")).not.toBeNull();
    expect(status.querySelectorAll("circle").length).toBeGreaterThan(8);
  });

  it("orbit-ring is a circular comet, not a filled disc or lucide icon", () => {
    const { container } = render(<Loader label="Orbit" type="orbit-ring" />);

    expect(screen.getByRole("status", { name: "Orbit" }).querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll("circle").length).toBeGreaterThan(8);
    expect(container.querySelector("path")).not.toBeNull();
  });
});
