// Apple Design System Styles
export const appleTheme = {
  // Colors
  colors: {
    background: '#f5f5f7',
    backgroundDark: '#000000',
    surface: '#ffffff',
    primary: '#0071e3',
    primaryHover: '#0077ed',
    text: '#1d1d1f',
    textSecondary: 'rgba(0, 0, 0, 0.8)',
    textTertiary: 'rgba(0, 0, 0, 0.48)',
    border: 'rgba(0, 0, 0, 0.1)',
    link: '#0066cc',
    linkDark: '#2997ff',
  },

  // Typography
  fonts: {
    display: 'SF Pro Display, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
    text: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
  },

  // Shadows
  shadows: {
    card: 'rgba(0, 0, 0, 0.08) 0px 2px 12px 0px',
    cardHover: 'rgba(0, 0, 0, 0.12) 0px 4px 20px 0px',
  },

  // Border Radius
  radius: {
    small: '8px',
    medium: '12px',
    large: '18px',
    pill: '980px',
  },
};

// Common Styles
export const appleStyles = {
  pageContainer: {
    fontFamily: appleTheme.fonts.text,
    background: appleTheme.colors.background,
    minHeight: '100vh',
    padding: '32px 40px',
  },

  pageTitle: {
    fontFamily: appleTheme.fonts.display,
    fontSize: '40px',
    fontWeight: 600,
    lineHeight: 1.1,
    color: appleTheme.colors.text,
    margin: 0,
  },

  sectionTitle: {
    fontFamily: appleTheme.fonts.display,
    fontSize: '28px',
    fontWeight: 400,
    lineHeight: 1.14,
    letterSpacing: '0.196px',
    color: appleTheme.colors.text,
    marginBottom: '16px',
  },

  card: {
    background: appleTheme.colors.surface,
    borderRadius: appleTheme.radius.large,
    padding: '24px',
    boxShadow: appleTheme.shadows.card,
    transition: 'all 0.3s ease',
  },

  button: {
    primary: {
      height: '40px',
      padding: '0 20px',
      fontSize: '14px',
      fontWeight: 400,
      background: appleTheme.colors.primary,
      border: 'none',
      borderRadius: appleTheme.radius.pill,
      color: '#ffffff',
      transition: 'background 0.2s ease',
      cursor: 'pointer',
    },
    secondary: {
      height: '40px',
      padding: '0 20px',
      fontSize: '14px',
      fontWeight: 400,
      background: 'transparent',
      border: `1px solid ${appleTheme.colors.border}`,
      borderRadius: appleTheme.radius.pill,
      color: appleTheme.colors.textSecondary,
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    },
  },

  input: {
    height: '40px',
    fontSize: '14px',
    background: appleTheme.colors.surface,
    border: `1px solid ${appleTheme.colors.border}`,
    borderRadius: appleTheme.radius.small,
    color: appleTheme.colors.text,
    padding: '0 12px',
    fontFamily: appleTheme.fonts.text,
  },

  table: {
    background: appleTheme.colors.surface,
    borderRadius: appleTheme.radius.medium,
    overflow: 'hidden',
    boxShadow: appleTheme.shadows.card,
  },
};

// Button Hover Handlers
export const buttonHoverHandlers = {
  primary: {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = appleTheme.colors.primaryHover;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = appleTheme.colors.primary;
    },
  },
  secondary: {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.borderColor = appleTheme.colors.border;
    },
  },
};
