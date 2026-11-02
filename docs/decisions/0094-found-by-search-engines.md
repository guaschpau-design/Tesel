# 0094. Let search engines find the home page

- Status: Accepted
- Date: 2026-11-02

## Context

Searching for Tesel found nothing of it: tesel.eu was not in Google's index. The home page told search engines little: no canonical address, a language alternate only one way and relative, no list of its pages, and nothing to show when a link to it was shared.

## Decision

- `robots.txt` lets crawlers read the site and keeps them out of the app (`/app/`), the base map (`/maps/`) and the relay (`/v1/`), which are not pages to find; it names the sitemap.
- `sitemap.xml` lists the home page in both languages, each with its alternate.
- Each home page states its canonical address and both languages, with Spanish as the default (`hreflang`), all as absolute addresses.
- Each home page has Open Graph and Twitter card tags: its title, its description and a picture in its language (`img/share-*.jpg`), so a link shared in a chat or a post shows what Tesel is.
- Each home page declares the site's name, Tesel, as `WebSite` structured data, which search engines use to name the site in results.
- The legal pages stay out of the index (`noindex`), as before.
- Owning the site in Google Search Console, and in Bing Webmaster Tools, is done by the project's owner, with their account.

## Consequences

- Search engines can index the home page once they learn of it; Search Console tells them and shows how the site does.
- Being found for a search for "Tesel" comes first; being found for what Tesel does depends on the words of the page and on other sites linking to it.
- The share pictures carry the home page's words: when those change, the pictures are made again (`img/README.md`).
