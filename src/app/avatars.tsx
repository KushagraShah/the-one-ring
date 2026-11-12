import portraits from '../assets/avatars/portraits.svg'

export type AvatarGroup = 'Fellowship' | 'Allies' | 'Dark' | 'Classic'
type Avatar = { id: string; label: string; group: AvatarGroup; symbol?: string; portrait?: string }
export const DEFAULT_AVATAR = 'lotr-sauron'

const character = (id: string, label: string, group: AvatarGroup): Avatar => ({ id: `lotr-${id}`, label, group, portrait: id })
export const avatars: Avatar[] = [
  character('frodo', 'Frodo', 'Fellowship'), character('sam', 'Sam', 'Fellowship'), character('merry', 'Merry', 'Fellowship'), character('pippin', 'Pippin', 'Fellowship'), character('gandalf', 'Gandalf', 'Fellowship'), character('aragorn', 'Aragorn', 'Fellowship'), character('legolas', 'Legolas', 'Fellowship'), character('gimli', 'Gimli', 'Fellowship'), character('boromir', 'Boromir', 'Fellowship'),
  character('treebeard', 'Treebeard', 'Allies'), character('bilbo', 'Bilbo', 'Allies'), character('galadriel', 'Galadriel', 'Allies'), character('arwen', 'Arwen', 'Allies'), character('elrond', 'Elrond', 'Allies'), character('eowyn', 'Éowyn', 'Allies'), character('theoden', 'Théoden', 'Allies'), character('eomer', 'Éomer', 'Allies'), character('faramir', 'Faramir', 'Allies'), character('denethor', 'Denethor', 'Allies'),
  character('sauron', 'Sauron', 'Dark'), character('saruman', 'Saruman', 'Dark'), character('witch-king', 'Witch-king', 'Dark'), character('gollum', 'Gollum', 'Dark'), character('balrog', 'Balrog', 'Dark'), character('wormtongue', 'Wormtongue', 'Dark'), character('lurtz', 'Lurtz', 'Dark'), character('shelob', 'Shelob', 'Dark'),
  { id: 'circle', label: 'Circle', group: 'Classic', symbol: '◉' }, { id: 'sun', label: 'Sun', group: 'Classic', symbol: '☀' }, { id: 'leaf', label: 'Leaf', group: 'Classic', symbol: '🌿' }, { id: 'star', label: 'Star', group: 'Classic', symbol: '★' }, { id: 'moon', label: 'Moon', group: 'Classic', symbol: '☾' },
]

export function AvatarImage({ id }: { id: string }) {
  const avatar = avatars.find(item => item.id === id) || avatars.find(item => item.id === DEFAULT_AVATAR)!
  return avatar.portrait ? <svg className="avatar-portrait" viewBox="0 0 100 100" aria-hidden="true"><use href={`${portraits}#${avatar.portrait}`}/></svg> : <span aria-hidden="true">{avatar.symbol}</span>
}
