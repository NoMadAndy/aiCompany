"""Web Research Task - searches the web for information with focus on scientific sources"""

import logging
import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger("research")


async def web_search(query: str, max_results: int = 5) -> list:
    """Perform web search and extract relevant content"""
    results = []

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            # DuckDuckGo HTML search (no API key needed)
            resp = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": query},
                headers={"User-Agent": "Mozilla/5.0 (compatible; AICompany/0.1)"}
            )
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for result in soup.select(".result__body")[:max_results]:
                    title_el = result.select_one(".result__title")
                    snippet_el = result.select_one(".result__snippet")
                    link_el = result.select_one(".result__url")
                    if title_el and snippet_el:
                        results.append({
                            "title": title_el.get_text(strip=True),
                            "snippet": snippet_el.get_text(strip=True),
                            "url": link_el.get_text(strip=True) if link_el else "",
                        })
        except Exception as e:
            logger.error(f"Search error: {e}")

    return results


async def search_scientific(query: str) -> list:
    """Search for scientific papers via Semantic Scholar API"""
    results = []

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params={"query": query, "limit": 5, "fields": "title,abstract,year,citationCount,url"}
            )
            if resp.status_code == 200:
                data = resp.json()
                for paper in data.get("data", []):
                    results.append({
                        "title": paper.get("title", ""),
                        "abstract": (paper.get("abstract") or "")[:300],
                        "year": paper.get("year"),
                        "citations": paper.get("citationCount", 0),
                        "url": paper.get("url", ""),
                        "source": "Semantic Scholar",
                    })
        except Exception as e:
            logger.error(f"Semantic Scholar error: {e}")

    return results
