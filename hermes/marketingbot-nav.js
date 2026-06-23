(() => {
  const addMarketingbotLink = () => {
    if (document.getElementById('marketingbot-return-link')) return;

    const link = document.createElement('a');
    link.id = 'marketingbot-return-link';
    link.href = '/';
    link.textContent = '← Marketingbot';
    link.setAttribute('aria-label', 'Return to Marketingbot dashboard');
    link.title = 'Return to Marketingbot dashboard';
    Object.assign(link.style, {
      position: 'fixed',
      top: '12px',
      left: '18px',
      zIndex: '99999',
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '36px',
      padding: '0 12px',
      border: '1px solid rgba(255, 207, 0, 0.34)',
      borderRadius: '9px',
      background: '#171724',
      color: '#ffe36b',
      fontFamily: 'inherit',
      fontSize: '14px',
      fontWeight: '700',
      lineHeight: '1',
      letterSpacing: '0.01em',
      textDecoration: 'none',
      boxShadow: '0 5px 16px rgba(0, 0, 0, 0.25)',
    });
    link.addEventListener('mouseenter', () => { link.style.background = '#242333'; });
    link.addEventListener('mouseleave', () => { link.style.background = '#171724'; });
    document.body.appendChild(link);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addMarketingbotLink, { once: true });
  } else {
    addMarketingbotLink();
  }
})();
