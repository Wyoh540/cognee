import AuthContentSectionCarousel from "@/ui/elements/Auth/ContentSections/AuthContentSectionCarousel";
import AuthPageContainer from "@/ui/elements/Auth/AuthPageContainer";
import { Center, Flex } from "@mantine/core";
import SignUpForm from "./partials/SignUpForm";

export default function SignUpPage() {
  return (
    <AuthPageContainer>
      <Center className="flex-1 flex-col">
        <Flex className="flex-col items-center w-full px-6 lg:w-[50vw] lg:px-0">
          <SignUpForm />
        </Flex>
      </Center>
      <AuthContentSectionCarousel />
    </AuthPageContainer>
  );
}
