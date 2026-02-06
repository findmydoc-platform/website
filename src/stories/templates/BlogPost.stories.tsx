import type { Meta, StoryObj } from '@storybook/react-vite'
import { Container } from '@/components/molecules/Container'
import { PostHero } from '@/components/organisms/Heroes/PostHero'
import { PostActionBar } from '@/components/molecules/PostActionBar'
import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import postHeroImage from '@/stories/assets/post-hero-exam-room.jpg'
import authorAvatar from '@/stories/assets/doctor-portrait.jpg'
import { collectionPosts } from '@/stories/organisms/fixtures'

const meta: Meta = {
  title: 'Templates/Blog/Blog Post',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta

export const Default: StoryObj = {
  render: () => (
    <div className="flex min-h-screen flex-col">
      {/* Post Hero */}
      <PostHero
        title="Die Zukunft der Zahnmedizin: KI und digitale Diagnostik"
        excerpt="Die Integration von künstlicher Intelligenz und digitalen Technologien verändert die zahnmedizinische Praxis grundlegend."
        categories={['Zahnmedizin', 'Technologie']}
        author={{
          name: 'Dr. Sarah Weber',
          role: 'Fachzahnärztin für Prothetik',
          avatar: typeof authorAvatar === 'string' ? authorAvatar : authorAvatar.src,
        }}
        publishedAt="2026-01-15T10:00:00.000Z"
        readTime="8 Min. Lesezeit"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Blog', href: '/posts' },
          { label: 'Zahnmedizin', href: '/posts?category=zahnmedizin' },
        ]}
        image={{
          src: postHeroImage,
          alt: 'Modern dental examination room with diagnostic equipment',
        }}
      />

      {/* Action Bar */}
      <PostActionBar />

      {/* Post Content */}
      <Container className="py-12 md:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl">
          {/* Prose Content Mock */}
          <div className="prose prose-lg max-w-none dark:prose-invert">
            <p className="lead text-xl text-muted-foreground">
              Die Integration von künstlicher Intelligenz und digitalen Technologien verändert die zahnmedizinische
              Praxis grundlegend. Moderne Diagnoseverfahren ermöglichen präzisere Behandlungen und bessere
              Patientenergebnisse.
            </p>

            <h2>Digitale Bildgebung revolutioniert die Diagnostik</h2>
            <p>
              Hochauflösende digitale Röntgenbilder und 3D-Scans bieten Zahnärzten heute völlig neue Möglichkeiten. Die
              sofortige Verfügbarkeit der Bilder beschleunigt nicht nur den Diagnoseprozess, sondern reduziert auch die
              Strahlenbelastung für Patienten um bis zu 90%.
            </p>

            <p>
              Mit Intraoralscannern können präzise digitale Abdrücke erstellt werden, die wesentlich angenehmer für
              Patienten sind als herkömmliche Abformmaterialien. Diese Technologie bildet die Grundlage für
              computergestützte Behandlungsplanung und CAD/CAM-Verfahren.
            </p>

            <h2>KI-gestützte Diagnoseunterstützung</h2>
            <p>
              Künstliche Intelligenz analysiert Röntgenbilder mit beeindruckender Genauigkeit und unterstützt Zahnärzte
              bei der Früherkennung von Karies, Parodontitis und anderen Erkrankungen. Algorithmen können Muster
              erkennen, die dem menschlichen Auge möglicherweise entgehen.
            </p>

            <ul>
              <li>Automatische Erkennung von Karies in frühen Stadien</li>
              <li>Präzise Vermessung von Knochendichte und Zahnfleischtaschen</li>
              <li>Vorhersage des Behandlungserfolgs anhand von Vergleichsdaten</li>
              <li>Optimierung der Behandlungsplanung durch Simulationen</li>
            </ul>

            <h2>Patientenkommunikation im digitalen Zeitalter</h2>
            <p>
              Die digitale Transformation verbessert auch die Kommunikation zwischen Zahnarzt und Patient.
              Behandlungspläne lassen sich visualisieren, Vorher-Nachher-Simulationen zeigen mögliche Ergebnisse und
              Online-Portale ermöglichen einen unkomplizierten Informationsaustausch.
            </p>

            <blockquote>
              <p>
                "Die Digitalisierung gibt uns Werkzeuge an die Hand, mit denen wir noch präziser arbeiten und unsere
                Patienten besser aufklären können. Das schafft Vertrauen und führt zu besseren Behandlungsergebnissen."
              </p>
              <footer>— Dr. Sarah Weber, Fachzahnärztin für Prothetik</footer>
            </blockquote>

            <h2>Ausblick: Was bringt die Zukunft?</h2>
            <p>
              Die Entwicklung schreitet rasant voran. Virtuelle Realität für die Behandlungsplanung, robotergestützte
              Präzisionseingriffe und personalisierte Therapien basierend auf genetischen Analysen sind keine
              Science-Fiction mehr, sondern werden bereits in spezialisierten Zentren eingesetzt.
            </p>

            <p>
              Entscheidend wird sein, diese Technologien sinnvoll zu integrieren und dabei die menschliche Komponente
              der zahnärztlichen Versorgung nicht aus den Augen zu verlieren. Technologie sollte den Zahnarzt
              unterstützen, nicht ersetzen.
            </p>
          </div>
        </div>
      </Container>

      {/* Related Posts Section */}
      <section className="border-t bg-muted/30 py-12 md:py-16">
        <Container>
          <h2 className="mb-8 text-2xl font-bold md:text-3xl">Ähnliche Artikel</h2>
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            {collectionPosts.slice(0, 2).map((post, index) => (
              <BlogCard.Overview key={index} {...post} />
            ))}
          </div>
        </Container>
      </section>
    </div>
  ),
}

export const WithoutRelatedPosts: StoryObj = {
  render: () => (
    <div className="flex min-h-screen flex-col">
      <PostHero
        title="Hautpflege im Winter: Expertentipps für gesunde Haut"
        categories={['Dermatologie']}
        authors="Dr. Michael Klein"
        publishedAt="2026-01-12T14:30:00.000Z"
        image={{
          src: postHeroImage,
          alt: 'Dermatology consultation in modern clinic',
        }}
      />

      <PostActionBar />

      <Container className="py-12 md:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="prose prose-lg max-w-none dark:prose-invert">
            <p className="lead text-xl text-muted-foreground">
              Die kalte Jahreszeit stellt besondere Anforderungen an unsere Haut. Trockene Heizungsluft und niedrige
              Temperaturen können zu Irritationen und Trockenheit führen.
            </p>

            <h2>Warum leidet die Haut im Winter?</h2>
            <p>
              Kalte Außenluft und warme Heizungsluft entziehen der Haut Feuchtigkeit. Die natürliche Lipidbarriere wird
              geschwächt, was zu Spannungsgefühlen, Rötungen und erhöhter Empfindlichkeit führen kann.
            </p>

            <h2>Die richtige Winterpflege-Routine</h2>
            <ul>
              <li>Reichhaltige Feuchtigkeitscremes mit Ceramiden und Hyaluronsäure</li>
              <li>Sanfte, pH-neutrale Reinigungsprodukte ohne Alkohol</li>
              <li>Regelmäßige Lippenpflege mit schützenden Balsamen</li>
              <li>UV-Schutz auch im Winter nicht vergessen</li>
            </ul>

            <p>
              Eine konsequente Pflegeroutine hilft, die Hautbarriere zu stärken und Winterbeschwerden vorzubeugen. Bei
              anhaltenden Problemen sollte immer ein Dermatologe konsultiert werden.
            </p>
          </div>
        </div>
      </Container>
    </div>
  ),
}

export const LongFormContent: StoryObj = {
  render: () => (
    <div className="flex min-h-screen flex-col">
      <PostHero
        title="Orthopädische Rehabilitation nach Sportverletzungen: Ein umfassender Leitfaden"
        categories={['Orthopädie', 'Sportmedizin', 'Rehabilitation']}
        authors="Dr. Anna Müller"
        publishedAt="2026-01-08T09:00:00.000Z"
        image={{
          src: postHeroImage,
          alt: 'Rehabilitation facility with modern physiotherapy equipment',
        }}
      />

      <PostActionBar />

      <Container className="py-12 md:py-16 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="prose prose-lg max-w-none dark:prose-invert">
            <p className="lead text-xl text-muted-foreground">
              Sportverletzungen erfordern eine individuelle, mehrstufige Rehabilitation. Dieser Artikel bietet einen
              umfassenden Überblick über moderne orthopädische Rehabilitationskonzepte.
            </p>

            <h2>1. Die akute Phase: Sofortmaßnahmen und Diagnostik</h2>
            <p>
              In den ersten Stunden nach einer Verletzung ist schnelles Handeln entscheidend. Die PECH-Regel (Pause,
              Eis, Compression, Hochlagern) bildet die Grundlage der Erstversorgung und kann die Heilungsdauer
              signifikant beeinflussen.
            </p>

            <h3>Bildgebende Diagnostik</h3>
            <p>
              Moderne Bildgebungsverfahren wie MRT und Ultraschall ermöglichen eine präzise Diagnose ohne
              Strahlenbelastung. Dies ist besonders wichtig bei Verdacht auf Bänderrisse oder Knorpelschäden.
            </p>

            <h2>2. Konservative vs. operative Behandlung</h2>
            <p>
              Nicht jede Sportverletzung erfordert einen operativen Eingriff. Moderne konservative Therapieansätze
              zeigen bei vielen Verletzungsmustern hervorragende Ergebnisse:
            </p>

            <ul>
              <li>Gezielte Physiotherapie zur Wiederherstellung der Beweglichkeit</li>
              <li>Propriozeptives Training für verbesserte Gelenkstabilität</li>
              <li>Manuelle Therapie zur Lösung von Verspannungen</li>
              <li>Medizinische Trainingstherapie zum Muskelaufbau</li>
            </ul>

            <h2>3. Die Rehabilitationsphasen im Detail</h2>

            <h3>Phase 1: Schutz und Mobilisation (Woche 1-2)</h3>
            <p>
              Ziel ist die Schmerzreduktion und erste vorsichtige Bewegungsübungen zur Vermeidung von Versteifungen.
              Isometrische Übungen erhalten die Muskelaktivität ohne Belastung des verletzten Gewebes.
            </p>

            <h3>Phase 2: Beweglichkeit und Kraft (Woche 3-6)</h3>
            <p>
              Systematischer Aufbau von Bewegungsumfang und Muskelkraft. Hydrotherapie und propriozeptives Training
              verbessern die neuromuskuläre Kontrolle.
            </p>

            <h3>Phase 3: Sportspezifisches Training (Woche 7-12)</h3>
            <p>
              Schrittweise Wiederaufnahme sportartspezifischer Bewegungen. Plyometrisches Training und
              Schnelligkeitsübungen bereiten auf die Rückkehr zum Wettkampfsport vor.
            </p>

            <h2>4. Prävention von Wiederverletzungen</h2>
            <p>
              Die Rückfallquote nach Sportverletzungen liegt ohne gezielte Prävention bei bis zu 40%.
              Präventionsprogramme reduzieren dieses Risiko erheblich:
            </p>

            <ol>
              <li>Individualisierte Screening-Tests zur Identifikation von Schwachstellen</li>
              <li>Regelmäßiges neuromuskuläres Training</li>
              <li>Anpassung der Trainingsbelastung an den Heilungsprozess</li>
              <li>Längerfristige physiotherapeutische Begleitung</li>
            </ol>

            <blockquote>
              <p>
                "Eine erfolgreiche Rehabilitation endet nicht mit der Schmerzfreiheit, sondern mit der sicheren Rückkehr
                zur vollen sportlichen Leistungsfähigkeit ohne erhöhtes Wiederverletzungsrisiko."
              </p>
              <footer>— Dr. Anna Müller, Fachärztin für Orthopädie und Sportmedizin</footer>
            </blockquote>

            <h2>5. Psychologische Aspekte der Rehabilitation</h2>
            <p>
              Die mentale Komponente wird oft unterschätzt. Angst vor Wiederverletzung, Frustration über langsame
              Fortschritte und Druck zur schnellen Rückkehr können den Heilungsprozess beeinträchtigen.
              Sportpsychologische Begleitung kann hier wertvolle Unterstützung bieten.
            </p>

            <h2>Fazit</h2>
            <p>
              Moderne orthopädische Rehabilitation kombiniert evidenzbasierte Therapieverfahren mit individueller
              Betreuung. Der Erfolg hängt maßgeblich von der Compliance des Patienten und der interdisziplinären
              Zusammenarbeit ab.
            </p>
          </div>
        </div>
      </Container>

      <section className="border-t bg-muted/30 py-12 md:py-16">
        <Container>
          <h2 className="mb-8 text-2xl font-bold md:text-3xl">Ähnliche Artikel</h2>
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            {collectionPosts.slice(1, 3).map((post, index) => (
              <BlogCard.Overview key={index} {...post} />
            ))}
          </div>
        </Container>
      </section>
    </div>
  ),
}
