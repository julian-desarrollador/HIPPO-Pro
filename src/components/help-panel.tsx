import { View } from "react-native";

import { FaqList } from "@/components/faq-list";
import { Dialog } from "@/components/form-controls";
import { SupportQuestionForm } from "@/components/support-question-form";

/** Ayuda in the account menu: the same FAQ as /entrada, and a question with the agency attached. */
export function HelpPanel({
  visible,
  onClose,
  onBack,
  displayName,
  userId,
  agencyId,
}: {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
  displayName: string;
  userId: string;
  agencyId: string;
}) {
  return (
    <Dialog visible={visible} title="Ayuda" onClose={onClose} onBack={onBack}>
      <View className="gap-5">
        <FaqList variant="app" />
        <View className="rounded-[14px] border border-line bg-card p-4">
          <SupportQuestionForm source="ayuda" initialName={displayName} userId={userId} agencyId={agencyId} />
        </View>
      </View>
    </Dialog>
  );
}
