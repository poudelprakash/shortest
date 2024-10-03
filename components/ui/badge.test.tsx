import * as React from "react"
import { render, screen } from "@testing-library/react"
import { Badge } from "@/components/Badge"
import "@testing-library/jest-dom/extend-expect" // For better matchers like `toHaveClass`

describe("Badge Component", () => {
  it("renders with default variant", () => {
    render(<Badge>Default Badge</Badge>)
    const badge = screen.getByText("Default Badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-primary", "text-primary-foreground")
  })

  it("renders with secondary variant", () => {
    render(<Badge variant="secondary">Secondary Badge</Badge>)
    const badge = screen.getByText("Secondary Badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-secondary", "text-secondary-foreground")
  })

  it("renders with destructive variant", () => {
    render(<Badge variant="destructive">Destructive Badge</Badge>)
    const badge = screen.getByText("Destructive Badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("bg-destructive", "text-destructive-foreground")
  })

  it("renders with outline variant", () => {
    render(<Badge variant="outline">Outline Badge</Badge>)
    const badge = screen.getByText("Outline Badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("text-foreground")
  })

  it("accepts additional className", () => {
    render(<Badge className="custom-class">Custom Badge</Badge>)
    const badge = screen.getByText("Custom Badge")
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass("custom-class")
  })
})
