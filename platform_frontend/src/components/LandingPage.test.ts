import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { LandingPage } from './LandingPage'

describe('public landing page', () => {
  it('explains patient and operations capabilities and provides account actions', () => {
    const html = renderToStaticMarkup(
      createElement(
        StaticRouter,
        { location: '/' },
        createElement(LandingPage),
      ),
    )

    expect(html).toContain('Make the next care decision with')
    expect(html).toContain('Find nearby hospitals')
    expect(html).toContain('Check reported resources')
    expect(html).toContain('Request an appointment')
    expect(html).toContain('Coordinate healthcare teams')
    expect(html).toContain('Create an account')
    expect(html).toContain('Sign in')
    expect(html).toContain('not live hospital availability')
    expect(html).toContain('not connected to an external ambulance provider')
  })
})
