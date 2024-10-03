import { render } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<Badge>Default</Badge>);
    expect(baseElement).toBeTruthy();
  });

  it('should render children', () => {
    const { getByText } = render(<Badge>Badge Content</Badge>);
    expect(getByText('Badge Content')).toBeInTheDocument();
  });

  it('should have default variant class', () => {
    const { container } = render(<Badge>test</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('rounded-md border px-2 py-1 text-sm font-medium');
  });

  it('should support custom variant', () => {
    const { container } = render(<Badge variant="destructive">test</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80');
  });

  it('should support custom class', () => {
    render(<Badge className="custom-class">test</Badge>);
    const badge = document.querySelector('.custom-class');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('custom-class');
  });

  it('should support the warning variant', () => {
    const { container } = render(<Badge variant="warning">test</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('border-transparent bg-orange-100 text-orange-500 hover:bg-orange-200');
  });
});
