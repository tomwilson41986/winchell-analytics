module.exports = function (eleventyConfig) {
  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/favicon.ico");

  // Watch CSS for changes in dev
  eleventyConfig.addWatchTarget("src/assets/css/");

  // Pass through CSS
  eleventyConfig.addPassthroughCopy("src/assets/css");

  // Custom collection: horses in training
  eleventyConfig.addCollection("horsesInTraining", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/horses/in-training/*.md")
      .filter((item) => !item.data.isIndex)
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
  });

  // Custom collection: workout reports
  eleventyConfig.addCollection("workoutReports", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/horses/workout-reports/*.md")
      .filter((item) => !item.data.isIndex)
      .sort((a, b) => (b.data.date || 0) - (a.data.date || 0));
  });

  // Shortcode: data table from global data
  eleventyConfig.addShortcode("dataTable", function (dataArray, columns) {
    if (!dataArray || dataArray.length === 0) {
      return '<p class="no-data">No data available.</p>';
    }

    const cols = columns || Object.keys(dataArray[0]);
    let html = '<div class="table-wrapper"><table class="data-table">';
    html += "<thead><tr>";
    for (const col of cols) {
      const header = col
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .replace(/_/g, " ");
      html += `<th>${header}</th>`;
    }
    html += "</tr></thead><tbody>";

    for (const row of dataArray) {
      html += "<tr>";
      for (const col of cols) {
        html += `<td>${row[col] !== undefined ? row[col] : ""}</td>`;
      }
      html += "</tr>";
    }

    html += "</tbody></table></div>";
    return html;
  });

  // Shortcode: horse card
  eleventyConfig.addShortcode("horseCard", function (horse) {
    return `
    <div class="horse-card">
      <div class="horse-card-header">
        <h3>${horse.name}</h3>
        <span class="horse-status status-${horse.status.toLowerCase().replace(/\s+/g, "-")}">${horse.status}</span>
      </div>
      <div class="horse-card-body">
        <dl>
          <dt>Sire</dt><dd>${horse.sire}</dd>
          <dt>Dam</dt><dd>${horse.dam}</dd>
          <dt>Trainer</dt><dd>${horse.trainer}</dd>
          <dt>Color</dt><dd>${horse.color}</dd>
          <dt>Sex</dt><dd>${horse.sex}</dd>
          <dt>Foaled</dt><dd>${horse.foaled}</dd>
        </dl>
      </div>
    </div>`;
  });

  // Filter: format currency
  eleventyConfig.addFilter("currency", function (value) {
    if (!value) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  });

  // Filter: format date
  eleventyConfig.addFilter("dateFormat", function (value) {
    if (!value) return "";
    const date = new Date(value);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
