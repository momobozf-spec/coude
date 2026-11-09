/**
 * Vervanging voor het `server-only`-pakket tijdens tests.
 *
 * Het echte pakket gooit zodra het buiten een React-servercomponent
 * geïmporteerd wordt — dat is de bescherming die voorkomt dat `src/config/env.ts`
 * met zijn secrets ooit in een clientbundle belandt. Een testrunner heeft geen
 * servercontext, dus daar zou die bescherming elke test blokkeren die
 * (indirect) env of een repository importeert.
 *
 * Deze stub is alleen aan `vitest.config.ts` gekoppeld en raakt de build niet:
 * in `next build` blijft het echte pakket actief.
 */
export {}
