// Neutral placeholder used when a listing's image URL is missing or fails to load.
export const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e9e9e3"/>' +
    '<rect x="170" y="118" width="60" height="44" rx="3" fill="none" stroke="#b9bab3" stroke-width="3"/>' +
    '<circle cx="188" cy="134" r="5" fill="#b9bab3"/><path d="M174 158l16-14 10 8 12-12 14 18" fill="none" stroke="#b9bab3" stroke-width="3"/></svg>'
  );

export const imgFallback = (e) => {
  if (e.currentTarget.src !== PLACEHOLDER_IMG) e.currentTarget.src = PLACEHOLDER_IMG;
};
