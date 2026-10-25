import { describe, expect, it } from 'vitest'

import { resolveDatabaseTarget, searchPathStatement } from '@/repositories/database-url'

const BASE = 'postgresql://user:p%40ss@db.example.com:5432/postgres'

describe('resolveDatabaseTarget', () => {
  it('laat een URL zonder query ongemoeid (public, oud gedrag)', () => {
    expect(resolveDatabaseTarget(BASE)).toEqual({ connectionString: BASE, schema: undefined })
  })

  it('laat een URL zonder schema-parameter ongemoeid', () => {
    const url = `${BASE}?sslmode=require`
    expect(resolveDatabaseTarget(url)).toEqual({ connectionString: url, schema: undefined })
  })

  it('haalt het schema uit de URL en houdt de andere parameters', () => {
    expect(resolveDatabaseTarget(`${BASE}?sslmode=require&schema=leadrevive`)).toEqual({
      connectionString: `${BASE}?sslmode=require`,
      schema: 'leadrevive',
    })
    expect(resolveDatabaseTarget(`${BASE}?schema=leadrevive`)).toEqual({
      connectionString: BASE,
      schema: 'leadrevive',
    })
  })

  it('behandelt schema=public en een lege waarde als standaard', () => {
    expect(resolveDatabaseTarget(`${BASE}?schema=public`)).toEqual({ connectionString: BASE, schema: undefined })
    expect(resolveDatabaseTarget(`${BASE}?schema=`)).toEqual({ connectionString: BASE, schema: undefined })
  })

  it.each(['Leadrevive', '1app', 'lead-revive', 'a"; DROP SCHEMA public; --', 'x'.repeat(64), 'lead revive'])(
    'weigert de ongeldige schema-naam %j',
    (name) => {
      expect(() => resolveDatabaseTarget(`${BASE}?schema=${encodeURIComponent(name)}`)).toThrow(
        /Ongeldige schema-naam/,
      )
    },
  )

  it('aanvaardt namen tot 63 tekens', () => {
    const name = `_${'a'.repeat(62)}`
    expect(resolveDatabaseTarget(`${BASE}?schema=${name}`).schema).toBe(name)
  })

  it('lekt het wachtwoord niet in de foutmelding', () => {
    let message = ''
    try {
      resolveDatabaseTarget(`${BASE}?schema=Fout`)
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/Ongeldige schema-naam/)
    expect(message).not.toContain('p%40ss')
  })
})

describe('searchPathStatement', () => {
  it('zet het app-schema vóór public', () => {
    expect(searchPathStatement('leadrevive')).toBe('SET search_path TO "leadrevive", public')
  })
})
