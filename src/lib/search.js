import {
  AutoTokenizer,
  AutoProcessor,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env
} from '@huggingface/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

const MODEL_ID = 'Xenova/clip-vit-base-patch16'

let tokenizer
let textModel
let processor
let visionModel

const imageEmbeddingCache = new Map()
const categoryEmbeddingCache = new Map()

/**
 * Explicit category searches should behave like semantic filters, not just
 * weak ranking hints. Each category has multiple visual prompts so a query
 * such as "cafe" can match storefronts, interiors, coffee tables and people
 * sitting in a cafe, while "plant" can match trees, flowers and greenery.
 */
const categoryDefinitions = {
  medicine: {
    triggers: [
      'medicine','medicines','medical','drug','drugs','pharmacy',
      'pill','pills','tablet','tablets','capsule','capsules',
      'injection','injections','syringe','syringes','hospital','healthcare'
    ],
    prompts: [
      'a photograph of medicine boxes and pharmaceutical products',
      'a photograph of pills tablets capsules or medicines',
      'a photograph of an injection syringe or medical supplies',
      'a photograph of pharmacy or healthcare products'
    ]
  },

  cafe: {
    triggers: [
      'cafe','cafes','café','coffee','coffeehouse','coffeeshop',
      'tea','restaurant','bakery','brunch'
    ],
    prompts: [
      'a photograph of a cafe or coffee shop storefront',
      'a photograph of the inside of a cafe or coffee shop',
      'a photograph of people sitting at a cafe table',
      'a photograph of coffee or tea served in a cafe',
      'a photograph of a cafe counter restaurant seating or bakery cafe'
    ]
  },

  plants: {
    triggers: [
      'plant','plants','tree','trees','flower','flowers','leaf','leaves',
      'garden','greenery','potted','pot','vegetation'
    ],
    prompts: [
      'a photograph of plants and greenery',
      'a photograph of trees and leaves',
      'a photograph of flowers and garden plants',
      'a photograph of potted plants or indoor plants'
    ]
  },

  vehicle: {
    triggers: [
      'vehicle','vehicles','car','cars','automobile','automobiles',
      'bike','bikes','bicycle','bicycles','motorcycle','motorcycles',
      'bus','buses','train','trains','auto','rickshaw','taxi',
      'truck','trucks','van','vans','scooter','scooters'
    ],
    prompts: [
      'a photograph of a car or automobile',
      'a photograph of a motorcycle bicycle bike or scooter',
      'a photograph of a bus taxi truck van or auto rickshaw',
      'a photograph of a train or other vehicle'
    ]
  },

  people: {
    triggers: [
      'person','people','friend','friends','family','portrait','selfie',
      'group','crowd','woman','women','man','men','girl','girls','boy','boys'
    ],
    prompts: [
      'a photograph of a person or portrait',
      'a photograph of friends or family',
      'a photograph of a group of people or crowd',
      'a selfie or casual photograph of people'
    ]
  },

  city: {
    triggers: [
      'city','urban','building','buildings','street','streets',
      'road','roads','traffic','skyline','downtown'
    ],
    prompts: [
      'a photograph of a city skyline or urban buildings',
      'a photograph of a city street or road',
      'a photograph of traffic in a city',
      'a photograph of a downtown urban scene'
    ]
  },

  landscape: {
    triggers: [
      'landscape','mountain','mountains','beach','sea','river','forest',
      'valley','hill','hills','sunset','sunrise','scenery','nature'
    ],
    prompts: [
      'a photograph of mountains hills or a valley',
      'a photograph of a beach sea or river',
      'a photograph of a forest or natural landscape',
      'a photograph of a sunset sunrise or scenic nature view'
    ]
  },

  document: {
    triggers: [
      'document','documents','paper','papers','note','notes','receipt',
      'receipts','book','books','page','pages','text','screenshot'
    ],
    prompts: [
      'a photograph of a document paper or printed page',
      'a photograph of notes a book or a receipt',
      'a screenshot containing text or a document'
    ]
  },

  event: {
    triggers: [
      'event','events','concert','celebration','party','festival',
      'stage','wedding','birthday','ceremony'
    ],
    prompts: [
      'a photograph of a party celebration or birthday',
      'a photograph of a concert festival or stage event',
      'a photograph of a wedding or ceremony',
      'a photograph of people attending an event'
    ]
  },

  food: {
    triggers: [
      'food','meal','meals','dish','dishes','dessert','desserts',
      'cake','cakes','snack','snacks'
    ],
    prompts: [
      'a photograph of food or a meal',
      'a photograph of a dish or snack',
      'a photograph of dessert or cake'
    ]
  }
}

const synonyms = {
  cafe: ['coffee','coffeehouse','restaurant','bakery','table'],
  coffee: ['cafe','coffeehouse'],
  night: ['evening','lights','dark'],
  evening: ['night','lights'],

  people: ['friends','family','group','crowd'],
  person: ['people','portrait'],
  friend: ['friends','people','group'],
  friends: ['people','group'],

  medicine: ['pills','tablets','capsules','healthcare','pharmacy','bottle'],
  pill: ['pills','tablets','medicine'],
  pills: ['pill','tablets','medicine'],
  tablet: ['tablets','medicine'],
  tablets: ['tablet','medicine'],

  plant: ['plants','tree','trees','flowers','greenery'],
  plants: ['plant','tree','trees','flowers','greenery'],
  tree: ['trees','plant','plants','greenery'],
  trees: ['tree','plant','plants','greenery'],

  vehicle: ['car','cars','bike','bus','train','taxi','truck','scooter'],
  car: ['vehicle','cars','automobile'],
  cars: ['vehicle','car','automobile'],

  city: ['urban','buildings','street','traffic'],
  trip: ['goa','beach','travel','mountain'],
  document: ['paper','notes','desk'],
  landscape: ['mountain','forest','beach','valley']
}

const stop = new Set([
  'a','an','the','of','in','on','at','with','and','or','i','it',
  'was','were','is','my','our','that','this','there','photo','picture',
  'maybe','think','remember','around','from'
])

export function tokenize(text = '') {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(x => x && !stop.has(x))
}

export function extractClues(text = '') {
  const uncertainty = /maybe|think|probably|roughly|around|not sure|perhaps/i.test(text)
  const words = tokenize(text)
  const unique = [...new Set(words)].slice(0, 8)

  return unique.map((value, i) => ({
    id: `clue-${Date.now()}-${i}`,
    value,
    certainty: uncertainty && i > 1 ? 'approximate' : 'certain',
    source: 'starting_memory',
    enabled: true
  }))
}

function expandedTerms(text) {
  const base = tokenize(text)
  const all = new Set(base)

  for (const term of base) {
    for (const related of (synonyms[term] || [])) {
      all.add(related)
    }
  }

  return [...all]
}

function requestedCategory(query = '') {
  const words = new Set(tokenize(query))

  for (const [name, definition] of Object.entries(categoryDefinitions)) {
    if (definition.triggers.some(trigger => words.has(trigger))) {
      return name
    }
  }

  return null
}

export function metadataScore(query, photo) {
  const terms = expandedTerms(query)
  const haystack = [
    photo.title || '',
    photo.description || '',
    photo.place || '',
    ...(photo.tags || [])
  ].join(' ').toLowerCase()

  if (!terms.length) return 0

  let hits = 0
  for (const term of terms) {
    if (haystack.includes(term)) hits += 1
  }

  const exactPhrase = haystack.includes(query.toLowerCase()) ? 1 : 0

  return Math.min(
    1,
    hits / Math.max(2, terms.length) + exactPhrase * 0.2
  )
}

function cosine(a, b) {
  let dot = 0
  let aa = 0
  let bb = 0

  const n = Math.min(a.length, b.length)

  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }

  return dot / (Math.sqrt(aa) * Math.sqrt(bb) + 1e-12)
}

async function loadModels(onStatus = () => {}) {
  if (tokenizer && textModel && processor && visionModel) return

  onStatus('Loading free CLIP browser model…')

  tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID)
  textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID)
  processor = await AutoProcessor.from_pretrained(MODEL_ID)
  visionModel = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID)

  onStatus('CLIP model ready')
}

async function textEmbedding(text) {
  const inputs = tokenizer([text], {
    padding: true,
    truncation: true
  })

  const { text_embeds } = await textModel(inputs)
  return text_embeds.tolist()[0]
}

async function imageEmbedding(photo) {
  if (imageEmbeddingCache.has(photo.id)) {
    return imageEmbeddingCache.get(photo.id)
  }

  const image = await RawImage.read(photo.url)
  const inputs = await processor(image)
  const { image_embeds } = await visionModel(inputs)
  const embedding = image_embeds.tolist()[0]

  imageEmbeddingCache.set(photo.id, embedding)
  return embedding
}

function visualPrompt(query) {
  const terms = expandedTerms(query)
  const enriched = terms.length ? terms.join(', ') : query

  return `a photograph showing ${query}. Relevant visual concepts: ${enriched}`
}

async function getCategoryPromptEmbeddings(categoryName) {
  if (!categoryName || !categoryDefinitions[categoryName]) return []

  if (categoryEmbeddingCache.has(categoryName)) {
    return categoryEmbeddingCache.get(categoryName)
  }

  const vectors = []

  for (const prompt of categoryDefinitions[categoryName].prompts) {
    vectors.push(await textEmbedding(prompt))
  }

  categoryEmbeddingCache.set(categoryName, vectors)
  return vectors
}

async function getAllCategoryPromptEmbeddings() {
  const result = {}

  for (const name of Object.keys(categoryDefinitions)) {
    result[name] = await getCategoryPromptEmbeddings(name)
  }

  return result
}

function bestSimilarity(imageEmbeddingVector, promptVectors = []) {
  if (!promptVectors.length) return -1

  return Math.max(
    ...promptVectors.map(vector => cosine(vector, imageEmbeddingVector))
  )
}

function addCategoryEvidence(scored, categoryEmbeddings, targetCategory) {
  if (!targetCategory) return scored

  return scored.map(item => {
    if (!item._embedding) return item

    const categoryScores = {}

    for (const [name, vectors] of Object.entries(categoryEmbeddings)) {
      categoryScores[name] = bestSimilarity(item._embedding, vectors)
    }

    const ordered = Object.entries(categoryScores)
      .sort((a, b) => b[1] - a[1])

    const targetScore = categoryScores[targetCategory] ?? -1

    const competitors = ordered
      .filter(([name]) => name !== targetCategory)
      .map(([, value]) => value)

    const competitorScore = competitors.length
      ? Math.max(...competitors)
      : -1

    const rank =
      ordered.findIndex(([name]) => name === targetCategory) + 1

    return {
      ...item,
      categoryTarget: targetCategory,
      categoryTargetScore: targetScore,
      categoryCompetitorScore: competitorScore,
      categoryMargin: targetScore - competitorScore,
      categoryRank: rank
    }
  })
}

function normalizeVisualScores(scored) {
  const visualItems = scored.filter(x => Number.isFinite(x.visualScore))

  if (!visualItems.length) {
    return scored.map(x => ({
      ...x,
      calibratedVisualScore: 0
    }))
  }

  const minVisual = Math.min(...visualItems.map(x => x.visualScore))
  const maxVisual = Math.max(...visualItems.map(x => x.visualScore))
  const spread = Math.max(1e-6, maxVisual - minVisual)

  return scored.map(x => ({
    ...x,
    calibratedVisualScore: Number.isFinite(x.visualScore)
      ? (x.visualScore - minVisual) / spread
      : 0
  }))
}

function rankGeneralSearch(scored) {
  const normalized = normalizeVisualScores(scored)

  return normalized
    .map(item => {
      let score =
        item.calibratedVisualScore * 0.76 +
        item.metadataScore * 0.24

      if (item.metadataScore >= 0.5) {
        score += 0.10
      }

      return {
        ...item,
        score: Math.max(0, Math.min(1, score))
      }
    })
    .sort((a, b) => b.score - a.score)
}

function rankExplicitCategorySearch(scored, targetCategory) {
  if (!targetCategory) {
    return rankGeneralSearch(scored)
  }

  const valid = scored.filter(
    item => Number.isFinite(item.categoryTargetScore)
  )

  if (!valid.length) {
    return rankGeneralSearch(scored)
  }

  const bestTargetScore = Math.max(
    ...valid.map(item => item.categoryTargetScore)
  )

  /**
   * For explicit category queries, category membership is the main signal.
   * We allow category rank #1, and a close rank #2 because cafe scenes can
   * naturally also look like people/food, and plant scenes can look like
   * landscape. Unrelated images are not used merely to fill the grid.
   */
  let candidates = valid.filter(item => {
    const closeToBest =
      item.categoryTargetScore >= bestTargetScore - 0.085

    const categoryCompetitive =
      item.categoryRank === 1 ||
      (
        item.categoryRank === 2 &&
        item.categoryMargin >= -0.025
      )

    return closeToBest && categoryCompetitive
  })

  /**
   * If the model is conservative, keep the strongest target-category matches
   * only. Never fill an explicit category search with random unrelated photos.
   */
  if (!candidates.length) {
    candidates = [...valid]
      .sort(
        (a, b) =>
          b.categoryTargetScore - a.categoryTargetScore
      )
      .slice(0, 3)
  }

  const targetValues =
    candidates.map(item => item.categoryTargetScore)

  const minTarget = Math.min(...targetValues)
  const maxTarget = Math.max(...targetValues)
  const targetSpread = Math.max(1e-6, maxTarget - minTarget)

  return candidates
    .map(item => {
      const categoryNorm =
        (item.categoryTargetScore - minTarget) / targetSpread

      let score =
        categoryNorm * 0.78 +
        item.metadataScore * 0.12 +
        Math.max(0, item.categoryMargin + 0.03) * 1.5

      if (item.categoryRank === 1) {
        score += 0.08
      }

      return {
        ...item,
        score: Math.max(0.01, Math.min(1, score))
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.categoryTargetScore - a.categoryTargetScore
    })
    .slice(0, 16)
}

export async function aiSearch(
  query,
  photos,
  {
    onStatus = () => {},
    onProgress = () => {}
  } = {}
) {
  try {
    await loadModels(onStatus)

    const targetCategory = requestedCategory(query)
    const queryEmbedding = await textEmbedding(visualPrompt(query))
    const scored = []

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]

      onProgress({
        done: i,
        total: photos.length,
        label: `Indexing ${i + 1} of ${photos.length}`
      })

      try {
        const embedding = await imageEmbedding(photo)

        scored.push({
          ...photo,
          score: 0,
          visualScore: cosine(queryEmbedding, embedding),
          metadataScore: metadataScore(query, photo),
          engine: 'CLIP browser AI',
          _embedding: embedding
        })
      } catch {
        scored.push({
          ...photo,
          score: metadataScore(query, photo),
          visualScore: null,
          metadataScore: metadataScore(query, photo),
          engine: 'metadata fallback'
        })
      }
    }

    let rankedInput = scored

    if (targetCategory) {
      onStatus(
        `Applying ${targetCategory.replace('_', ' ')} category filter…`
      )

      const categoryEmbeddings =
        await getAllCategoryPromptEmbeddings()

      rankedInput = addCategoryEvidence(
        scored,
        categoryEmbeddings,
        targetCategory
      )
    }

    const ranked = targetCategory
      ? rankExplicitCategorySearch(rankedInput, targetCategory)
      : rankGeneralSearch(rankedInput).slice(0, 16)

    onProgress({
      done: photos.length,
      total: photos.length,
      label: 'Ready'
    })

    onStatus(
      targetCategory
        ? `Showing ${targetCategory.replace('_', ' ')} matches`
        : 'CLIP model ready'
    )

    return ranked.map(({ _embedding, ...item }) => item)
  } catch (error) {
    console.warn('AI search failed; using metadata fallback.', error)

    onStatus(
      'CLIP unavailable — using local semantic fallback'
    )

    const fallback = photos
      .map(photo => {
        const score = metadataScore(query, photo)

        return {
          ...photo,
          score,
          visualScore: null,
          metadataScore: score,
          engine: 'local fallback'
        }
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)

    return fallback.slice(0, 16)
  }
}

export async function moreLikeThis(
  reference,
  photos,
  {
    onStatus = () => {},
    onProgress = () => {}
  } = {}
) {
  try {
    await loadModels(onStatus)

    const referenceEmbedding = await imageEmbedding(reference)
    const scored = []

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]

      onProgress({
        done: i,
        total: photos.length,
        label: `Comparing ${i + 1} of ${photos.length}`
      })

      const embedding = await imageEmbedding(photo)

      const visual = Math.max(
        0,
        (cosine(referenceEmbedding, embedding) + 1) / 2
      )

      scored.push({
        ...photo,
        score: visual,
        visualScore: visual,
        metadataScore: 0,
        engine: 'CLIP visual'
      })
    }

    onProgress({
      done: photos.length,
      total: photos.length,
      label: 'Ready'
    })

    return scored
      .filter(photo => photo.id !== reference.id)
      .sort((a, b) => b.score - a.score)
      .slice(0, 16)
  } catch (error) {
    console.warn(
      'Visual similarity failed; using tag overlap fallback.',
      error
    )

    return photos
      .filter(photo => photo.id !== reference.id)
      .map(photo => {
        const photoTags = photo.tags || []
        const referenceTags = reference.tags || []

        const overlap = photoTags.filter(tag =>
          referenceTags.includes(tag)
        ).length

        return {
          ...photo,
          score:
            overlap / Math.max(1, referenceTags.length),
          engine: 'similarity fallback'
        }
      })
      .filter(photo => photo.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 16)
  }
}

export function explanation(query, photo) {
  const terms = expandedTerms(query)

  const matched = (photo.tags || [])
    .filter(tag =>
      terms.some(
        queryTerm =>
          tag.includes(queryTerm) ||
          queryTerm.includes(tag)
      )
    )
    .slice(0, 4)

  if (matched.length) {
    return matched
  }

  if (photo.categoryTarget) {
    return [
      photo.categoryTarget.replace('_', ' ')
    ]
  }

  return (photo.tags || []).slice(0, 3)
}

export function clarificationFor(results, clues = []) {
  const enabled = new Set(
    clues
      .filter(clue => clue.enabled)
      .map(clue => clue.value.toLowerCase())
  )

  const top = results.slice(0, 8)

  if (!top.length) return null

  const hasIndoor = top.some(photo =>
    (photo.tags || []).includes('indoor')
  )

  const hasOutdoor = top.some(photo =>
    (photo.tags || []).includes('outdoor')
  )

  if (
    hasIndoor &&
    hasOutdoor &&
    !enabled.has('indoor') &&
    !enabled.has('outdoor')
  ) {
    return {
      question:
        'Do you remember whether it was indoors or outdoors?',
      options: ['indoors', 'outdoors', 'not sure']
    }
  }

  const hasNight = top.some(
    photo =>
      (photo.tags || []).includes('night') ||
      (photo.tags || []).includes('evening')
  )

  const hasDay = top.some(photo =>
    (photo.tags || []).includes('day')
  )

  if (
    hasNight &&
    hasDay &&
    !enabled.has('night') &&
    !enabled.has('day') &&
    !enabled.has('evening')
  ) {
    return {
      question:
        'Was it more like daytime or evening/night?',
      options: [
        'daytime',
        'evening / night',
        'not sure'
      ]
    }
  }

  const clusters = [
    ...new Set(
      top
        .map(photo => photo.cluster)
        .filter(Boolean)
    )
  ]

  if (clusters.length > 1) {
    return {
      question: 'Which kind of scene feels closest?',
      options: [
        ...clusters.slice(0, 3),
        'not sure'
      ]
    }
  }

  return null
}