// VERSION replaced by deploy script
module.exports = {
  title: 'chartjs-plugin-annotation',
  tagline: 'Annotation plugin for Chart.js',
  url: 'https://chartjs.org',
  baseUrl: '/chartjs-plugin-annotation/',
  favicon: 'img/favicon.ico',
  organizationName: 'chartjs', // Usually your GitHub org/user name.
  projectName: 'chartjs-plugin-annotation', // Usually your repo name.
  plugins: [],
  scripts: [
    'https://cdn.jsdelivr.net/npm/chart.js@3.0.0-beta.13/dist/chart.js',
    'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@1.0.0-beta.4/dist/chartjs-plugin-annotation.min.js'
  ],
  themes: ['@docusaurus/theme-live-codeblock'],
  themeConfig: {
    colorMode: {
      // Would need to implement for Charts embedded in docs
      disableSwitch: true,
    },
    navbar: {
      title: 'Chart.js Annotation Plugin',
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Developers',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/chartjs/chartjs-plugin-annotation',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Chart.js contributors.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          routeBasePath: '/',
          editUrl: 'https://github.com/chartjs/chartjs-plugin-annotation/edit/master/docs/',
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};