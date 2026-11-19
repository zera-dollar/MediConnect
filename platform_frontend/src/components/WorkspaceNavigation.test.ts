import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { WorkspaceNavigation } from './WorkspaceNavigation'

describe('workspace navigation', () => {
  it('exposes the Audit Centre link and marks the current page consistently', () => {
    const html = renderToStaticMarkup(
      createElement(StaticRouter, { location: '/audit' }, createElement(WorkspaceNavigation, { current: '/audit' })),
    )

    expect(html).toContain('href="/audit"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('Audit Centre')
    expect(html).toContain('href="/"')
    expect(html).toContain('href="/staffing"')
    expect(html).toContain('Staffing marketplace')
    expect(html).toContain('href="/notifications"')
    expect(html).toContain('Notifications')
    expect(html).toContain('href="/hospitals"')
    expect(html).toContain('Find hospitals')
    expect(html).toContain('href="/ambulance"')
    expect(html).toContain('Ambulance services')
    expect(html).toContain('href="/appointments"')
    expect(html).toContain('Book an appointment')
    expect(html).toContain('href="/oxygen"')
    expect(html).toContain('href="/resources"')
    expect(html).toContain('href="/analytics"')
    expect(html).toContain('href="/reports"')
    expect(html).toContain('href="/settings"')
    expect(html).toContain('System settings')
  })
})
