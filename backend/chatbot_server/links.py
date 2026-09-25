"""Source links included with answers."""
import re
from typing import Optional
from models import ActionLink

def extract_action_links(chunks: list[str]) -> Optional[list[ActionLink]]:
    if not chunks:
        return None

    url_pattern = re.compile(r'https?://[^\s<>"\'\)]+')
    links = []
    seen = set()

    for chunk in chunks:
        matches = url_pattern.findall(chunk)
        for url in matches:
            clean_url = url.rstrip(".,;")
            if clean_url not in seen:
                seen.add(clean_url)
                title = "View Course Details"
                if "tasc.tas.gov.au" in clean_url:
                    title = "View TASC Course Details"
                elif "hobartcollege" in clean_url:
                    title = "Visit Hobart College Page"
                links.append(ActionLink(title=title, url=clean_url))

    return links if links else None
