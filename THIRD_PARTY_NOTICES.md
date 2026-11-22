# Third-Party Notices

ChatKit is built on, and its container images include, the third-party
software listed below. All of it is under permissive licenses. These notices
must travel with the software: keep this file with any copy you are permitted
to make.

Where the notices live in the published images:

| Image | Notices |
|---|---|
| `pocketbase` | `/licenses/pocketbase-LICENSE.md` |
| `bot-service` | each package's own `LICENSE` file under `/app/node_modules/` |
| `builder-ui` | this file, served by the app at `/THIRD_PARTY_NOTICES.txt` |

---

## Main components

| Component | Where | License |
|---|---|---|
| [PocketBase](https://github.com/pocketbase/pocketbase) | `pocketbase` image (binary) | MIT © 2022 – present, Gani Georgiev |
| [PocketBase JS SDK](https://github.com/pocketbase/js-sdk) | bot-service, builder-ui | MIT © 2022 – present, Gani Georgiev |
| [Svelte](https://github.com/sveltejs/svelte) / [SvelteKit](https://github.com/sveltejs/kit) | builder-ui (compiled into the bundle) | MIT © Svelte Contributors |
| [Svelte Flow (@xyflow/svelte)](https://github.com/xyflow/xyflow) | builder-ui | MIT © 2019 – present, webkid GmbH |
| [dagre](https://github.com/dagrejs/dagre), [graphlib](https://github.com/dagrejs/graphlib) | builder-ui | MIT © 2012 – present, Chris Pettitt |
| [lodash](https://github.com/lodash/lodash) | builder-ui (via graphlib) | MIT © OpenJS Foundation and other contributors |
| [d3-ease](https://github.com/d3/d3-ease) and other d3 modules | builder-ui (via Svelte Flow) | ISC / BSD-3-Clause © Mike Bostock |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | builder-ui (generated CSS) | MIT © Tailwind Labs, Inc. |
| [daisyUI](https://github.com/saadeghi/daisyui) | builder-ui (generated CSS) | MIT © Pouya Saadeghi |
| [tslib](https://github.com/microsoft/tslib) | builder-ui | 0BSD © Microsoft Corporation |
| [Express](https://github.com/expressjs/express) | bot-service | MIT © TJ Holowaychuk, Roman Shtylman, Douglas Christopher Wilson |
| [cors](https://github.com/expressjs/cors) | bot-service | MIT © Troy Goode |
| [axios](https://github.com/axios/axios) | bot-service | MIT © Matt Zabriskie and contributors |
| [qs](https://github.com/ljharb/qs) | bot-service (via Express) | BSD-3-Clause © Nathan LaFreniere and other contributors |
| Express's remaining dependencies (~80 packages) | bot-service | MIT / ISC (texts in `node_modules`) |
| [nginx](https://nginx.org) | builder-ui image base | BSD-2-Clause © Igor Sysoev, Nginx, Inc. |
| [Node.js](https://nodejs.org) | bot-service image base | MIT and others © Node.js contributors |
| [Alpine Linux](https://alpinelinux.org) / Debian | image bases | various open-source licenses, see each distribution |

Not included, but used alongside: **Chatwoot** (MIT for the core edition) is
pulled from Chatwoot's own image by `docker-compose.full.yml`, and **Caddy**
(Apache-2.0) from its official image. ChatKit contains no Chatwoot or Caddy code.

---

## License texts

### MIT License

Applies to PocketBase, the PocketBase JS SDK, Svelte, SvelteKit, Svelte Flow,
dagre, graphlib, lodash, Tailwind CSS, daisyUI, Express, cors, axios and the
other MIT-licensed packages above, each under its own copyright line.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### ISC License

Applies to d3-ease and the other ISC-licensed packages, each under its own
copyright line.

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```

### BSD-3-Clause License

Applies to qs and the BSD-3-Clause d3 modules, each under its own copyright line.

```
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### 0BSD License

Applies to tslib (© Microsoft Corporation).

```
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
```
