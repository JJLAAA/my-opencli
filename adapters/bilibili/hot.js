export default {
  args: [{ name: 'limit', default: 20 }],
  columns: ['rank', 'title', 'author', 'play'],
  pipeline: [
    { navigate: 'https://www.bilibili.com' },
    { evaluate: `(async () => {
      const res = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=50&pn=1', {
        credentials: 'include'
      });
      const data = await res.json();
      return (data?.data?.list || []).map(v => ({
        title: v.title,
        author: v.owner?.name,
        play:   v.stat?.view,
      }));
    })()` },
    { map: {
      rank:   '${{ index + 1 }}',
      title:  '${{ item.title }}',
      author: '${{ item.author }}',
      play:   '${{ item.play }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
