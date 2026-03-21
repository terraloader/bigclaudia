const lang = (process.env.LANGUAGE || 'en').toLowerCase();

const locales = {
  en: () => require('./en'),
  de: () => require('./de'),
};

module.exports = (locales[lang] || locales.en)();
