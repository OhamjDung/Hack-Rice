/* Fictional companies + sector ETFs. Plain data — edit/balance freely. */
const COMPANIES = [
  // Oil & Energy
  { id: 'drwl', name: 'Drakewell Petroleum',   ticker: 'DRWL', sector: 'oil',      basePrice: 42,  volatility: 1.1 },
  { id: 'slmr', name: 'Solmar Energy Corp',     ticker: 'SLMR', sector: 'oil',      basePrice: 68,  volatility: 0.8 },
  { id: 'frcd', name: 'Ferrocrude Industries',  ticker: 'FRCD', sector: 'oil',      basePrice: 25,  volatility: 1.4 },
  { id: 'blwv', name: 'Bluewave Offshore',      ticker: 'BLWV', sector: 'oil',      basePrice: 90,  volatility: 1.0 },

  // Automotive
  { id: 'vltx', name: 'Voltrix Motors',         ticker: 'VLTX', sector: 'auto',     basePrice: 120, volatility: 1.2 },
  { id: 'ircl', name: 'Ironclad Auto Group',    ticker: 'IRCL', sector: 'auto',     basePrice: 35,  volatility: 0.9 },
  { id: 'nmbs', name: 'Nimbus EV',              ticker: 'NMBS', sector: 'auto',     basePrice: 80,  volatility: 1.5 },
  { id: 'rdln', name: 'Redline Motorworks',     ticker: 'RDLN', sector: 'auto',     basePrice: 55,  volatility: 1.0 },

  // Weapons & Defense
  { id: 'aegs', name: 'Aegis Dynamics',         ticker: 'AEGS', sector: 'defense',  basePrice: 150, volatility: 0.7 },
  { id: 'flcn', name: 'Falcon Arms Corp',       ticker: 'FLCN', sector: 'defense',  basePrice: 60,  volatility: 1.1 },
  { id: 'vngd', name: 'Vanguard Ordnance',      ticker: 'VNGD', sector: 'defense',  basePrice: 95,  volatility: 0.9 },
  { id: 'sntl', name: 'Sentinel Systems',       ticker: 'SNTL', sector: 'defense',  basePrice: 40,  volatility: 1.3 },

  // Utilities
  { id: 'bgrd', name: 'Brightgrid Power',       ticker: 'BGRD', sector: 'utilities',basePrice: 30,  volatility: 0.6 },
  { id: 'cscw', name: 'Cascade Water Co',       ticker: 'CSCW', sector: 'utilities',basePrice: 45,  volatility: 0.5 },
  { id: 'nlge', name: 'Northline Gas & Electric', ticker: 'NLGE', sector: 'utilities', basePrice: 22, volatility: 0.7 },
  { id: 'slcu', name: 'Solace Utilities',       ticker: 'SLCU', sector: 'utilities',basePrice: 38,  volatility: 0.6 },

  // Fintech
  { id: 'pyws', name: 'Paywise Financial',      ticker: 'PYWS', sector: 'fintech',  basePrice: 65,  volatility: 1.3 },
  { id: 'ldgr', name: 'Ledgerly Inc',           ticker: 'LDGR', sector: 'fintech',  basePrice: 28,  volatility: 1.6 },
  { id: 'cnst', name: 'Coinstream Technologies',ticker: 'CNST', sector: 'fintech',  basePrice: 110, volatility: 1.5 },
  { id: 'vlty', name: 'Vaultly Systems',        ticker: 'VLTY', sector: 'fintech',  basePrice: 50,  volatility: 1.0 },
];

const SECTORS = [
  { id: 'oil',       label: 'Oil & Energy' },
  { id: 'auto',      label: 'Automotive' },
  { id: 'defense',   label: 'Weapons & Defense' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'fintech',   label: 'Fintech' },
];

/* One composite ETF per sector, plus a broad market index. Prices are
   derived at runtime from constituent company prices (see app.js). */
const ETFS = [
  { id: 'oil_etf',       name: 'Grapefruit Energy Composite',    ticker: 'OILX', sector: 'oil' },
  { id: 'auto_etf',      name: 'Grapefruit Auto Composite',      ticker: 'AUTX', sector: 'auto' },
  { id: 'defense_etf',   name: 'Grapefruit Defense Composite',   ticker: 'DEFX', sector: 'defense' },
  { id: 'utilities_etf', name: 'Grapefruit Utilities Composite', ticker: 'UTLX', sector: 'utilities' },
  { id: 'fintech_etf',   name: 'Grapefruit Fintech Composite',   ticker: 'FINX', sector: 'fintech' },
  { id: 'market_etf',    name: 'Grapefruit Broad Market Index',  ticker: 'GRPX', sector: 'market' },
];
