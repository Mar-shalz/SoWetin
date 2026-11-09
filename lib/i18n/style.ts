import pcm from '@/messages/pcm.json';

// Approved app strings that show Chef how the app writes Pidgin (doc 03, 7.2). Plain interface lines only: trust notes
// never go near an AI prompt (doc 11, section 6), and tests/unit/chef.test.ts checks that.
export const pidginExamples = () => [pcm.house.subtitle, pcm.craving.understood, pcm.craving.none._, pcm.house.text.kept, pcm.plate.price.today];
