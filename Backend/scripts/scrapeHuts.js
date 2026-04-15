import "dotenv/config";

import { connectDB, disconnectDB } from "../connection.js";
import Hut from "../models/hut.js";

const BASE_URL = "https://www.btsbg.org";

/**
 * Extracts raw text from HTML safely
 */
function cleanHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Attempts to parse coordinates from the given text snippet
 * E.g., GPS: 41.756443ºN 23.416754ºЕ or similar
 */
function parseCoordinates(text) {
  // Common pattern: 41.something N 23.something E
  // Because they can have spaces like 41.756 443
  const regex = /([0-9]{2}[\.,][0-9\s]+)[^\d]*?[NС].*?([0-9]{2}[\.,][0-9\s]+)[^\d]*?[EИЕ]/i;
  let match = text.match(regex);
  if (match) {
    let lat = parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
    let lng = parseFloat(match[2].replace(/\s/g, "").replace(",", "."));
    if (!isNaN(lat) && !isNaN(lng)) {
      return [lng, lat];
    }
  }
  
  // Backup pattern
  const backupRegex = /GPS[^\d:]*?:.*?([0-9]+\.[0-9]+).*?([0-9]+\.[0-9]+)/i;
  match = text.match(backupRegex);
  if (match) {
    let lat = parseFloat(match[1]);
    let lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      // Assuming typical BG coords: Lat ~41-44, Lng ~22-28
      if (lat < lng) {
         return [lng, lat];
      }
      return [lng, lat]; // GeoJSON expects [lng, lat]
    }
  }
  return null;
}

/**
 * Main scraper function
 */
async function scrapeHuts() {
  await connectDB();
  console.log("Connected to DB, starting scrape...");

  try {
    const listRes = await fetch(`${BASE_URL}/hizhi`);
    const listHtml = await listRes.text();

    // Extract all links to specific huts. Pattern: <a href="/hizhi/hizha-vihren">
    const linkRegex = /href="(\/hizhi\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    const hutLinks = new Map();

    while ((match = linkRegex.exec(listHtml)) !== null) {
      const urlPath = match[1];
      const linkText = cleanHtml(match[2]);
      
      // Filter out utility links like /hizhi or pagination
      if (
        urlPath.length > 7 && 
        urlPath !== "/hizhi" && 
        !urlPath.includes("?") &&
        !urlPath.includes("#") &&
        !linkText.includes("Назад")
      ) {
        hutLinks.set(urlPath, linkText);
      }
    }

    console.log(`Found ${hutLinks.size} potential hut links. Processing...`);
    let count = 0;

    for (const [urlPath, hutName] of hutLinks) {
      count++;
      const fullUrl = `${BASE_URL}${urlPath}`;
      console.log(`[${count}/${hutLinks.size}] Fetching ${fullUrl}...`);
      
      try {
        const detailRes = await fetch(fullUrl);
        const detailHtml = await detailRes.text();

        // Very basic heuristic content extraction for btsbg.org node content
        // The main content is usually inside a div with class "content" or "field-item"
        
        let contentBlock = detailHtml;
        const mainContentMatch = detailHtml.match(/<div class="field-item even" property="content:encoded">([\s\S]*?)<\/div>/i);
        if (mainContentMatch) {
          contentBlock = mainContentMatch[1];
        }

        const textContent = cleanHtml(contentBlock);
        
        const coordinates = parseCoordinates(textContent);
        if (!coordinates) {
          console.log(`  -> Skipped (No valid coordinates format found)`);
          continue; // Only save huts we can put on the map
        }

        // Instead of awkwardly slicing the string with Regex, we pass the entire clean block to the DB
        // Our new frontend UI component naturally parses and separates the headers cleanly!
        const description = textContent;

        const contactsMatch = detailHtml.match(/За контакт:(.*?)<\/p>/i) || detailHtml.match(/За контакт:([\s\S]*?)(<br|$)/i);
        let contacts = "";
        if (contactsMatch) {
          contacts = cleanHtml(contactsMatch[1]);
        }

        // Try to gather comments/reviews
        const reviews = [];
        const commentBlocks = detailHtml.match(/<div class="comment-content">([\s\S]*?)<\/div>/g) || [];
        for (const block of commentBlocks) {
           const commentText = cleanHtml(block);
           if (commentText.trim().length > 0) {
             reviews.push({ username: "Anonymous", comment: commentText.trim() });
           }
        }

        const rating = reviews.length > 0 ? 5 : 0; // Fake rating just for demo if comments exist

        const hutDoc = {
          name: hutName.trim(),
          url: fullUrl,
          location: coordinates, // [lng, lat]
          description: description,
          contacts: contacts,
          reviews: reviews,
          averageRating: rating
        };

        // Upsert into DB
        await Hut.findOneAndUpdate(
          { url: fullUrl },
          { $set: hutDoc },
          { upsert: true, new: true }
        );
        console.log(`  -> Saved: ${hutName.trim()} at [${coordinates[0]}, ${coordinates[1]}]`);

        // slight delay to not overwhelm the server
        await new Promise(r => setTimeout(r, 200));

      } catch (err) {
        console.error(`  -> Failed to fetch/parse ${fullUrl}:`, err.message);
      }
    }

    console.log("Scraping completed.");
  } catch (err) {
    console.error("Scraper failed:", err);
  } finally {
    await disconnectDB();
  }
}

scrapeHuts();
