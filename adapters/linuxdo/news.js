export default {
  args: [{ name: 'limit', default: 3 }],
  columns: ['rank', 'title'],
  pipeline: [
    { navigate: 'https://linux.do/c/news/34' },
    { evaluate: `(async () => {
      const res = await fetch('https://linux.do/c/news/34.json');
      const data = await res.json();
      return (data?.topic_list?.topics || []).map(t => ({ title: t.title }));
    })()` },
    { map: {
      rank:  '${{ index + 1 }}',
      title: '${{ item.title }}',
    }},
    { limit: '${{ args.limit }}' },
  ],
};
