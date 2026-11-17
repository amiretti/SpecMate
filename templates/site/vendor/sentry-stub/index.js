// Empty stand-in for @sentry/node (ADR-0038): lighthouse only imports Sentry when enableErrorReporting is true,
// and SpecMate always passes false. Importing this module by mistake must fail loudly, not report anywhere.
throw new Error('@sentry/node is stubbed out in SpecMate (ADR-0038): enableErrorReporting must stay false');
