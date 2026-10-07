import { MicIcon, PaperclipIcon, PinIcon } from 'lucide-react';
import { useRef } from 'react';
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';

interface ComposerProps {
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text: string) => void;
  busy: boolean;
  onStop: () => void;
  onAttachFile: (file: File) => void;
  onVoice: () => void;
  listening: boolean;
  onLocate: () => void;
  locating: boolean;
  coordsActive: boolean;
  placeholder?: string;
  label: string;
}

export function Composer(props: ComposerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <PromptInput
      accept=".txt,.md,.csv,.json"
      maxFileSize={200 * 1024}
      onSubmit={(msg) => {
        const text = msg.text.trim().slice(0, 2000);
        if (text && !props.busy) props.onSend(text);
      }}
    >
      <PromptInputBody>
        <PromptInputTextarea
          value={props.input}
          onChange={(e) => props.onInputChange(e.target.value.slice(0, 2000))}
          placeholder={props.placeholder ?? 'Ask Taproot'}
          aria-label={props.label}
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) props.onAttachFile(f);
              e.target.value = '';
            }}
          />
          <PromptInputButton
            aria-label="Attach a text file"
            title="Attach a text file (.txt, .md, .csv, .json)"
            onClick={() => fileRef.current?.click()}
          >
            <PaperclipIcon className="size-4" />
          </PromptInputButton>
          <PromptInputButton
            aria-label={props.listening ? 'Listening…' : 'Ask by voice'}
            title="Ask by voice"
            onClick={props.onVoice}
            className={props.listening ? 'text-primary' : undefined}
          >
            <MicIcon className="size-4" />
          </PromptInputButton>
          <PromptInputButton
            aria-label={props.coordsActive ? 'Location on — tap to turn off' : 'Use my location'}
            title={props.coordsActive ? 'Location on — tap to turn off' : 'Use my location'}
            aria-pressed={props.coordsActive}
            onClick={props.onLocate}
            disabled={props.locating}
            className={props.coordsActive ? 'text-primary' : undefined}
          >
            <PinIcon className="size-4" />
          </PromptInputButton>
        </PromptInputTools>
        <PromptInputSubmit status={props.busy ? 'streaming' : 'ready'} onStop={props.onStop} aria-label={props.busy ? 'Stop' : 'Send'} />
      </PromptInputFooter>
    </PromptInput>
  );
}
