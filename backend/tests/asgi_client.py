import asyncio

import httpx


class ASGITestClient:
    def __init__(self, app):
        self.app = app

    def request(self, method, url, **kwargs):
        async def _send():
            transport = httpx.ASGITransport(app=self.app)
            async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as client:
                return await client.request(method, url, **kwargs)

        return asyncio.run(_send())

    def get(self, url, **kwargs):
        return self.request('GET', url, **kwargs)

    def post(self, url, **kwargs):
        return self.request('POST', url, **kwargs)

    def put(self, url, **kwargs):
        return self.request('PUT', url, **kwargs)
