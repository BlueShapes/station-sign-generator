import { Grid, Title, List, Anchor, Text } from "@mantine/core";
import { IconChevronsRight } from "@tabler/icons-react";

const Footer = () => {
  const linkContents = [
    { name: "Website", link: "https://aosankaku.github.io" },
    { name: "Twitter (Formerly X)", link: "https://twitter.com/@ao_sankaku" },
    {
      name: "Misskey (misskey.systems)",
      link: "https://misskey.systems/@ao_sankaku",
    },
    { name: "Misskey (yumk.xyz)", link: "https://yumk.xyz/@ao_sankaku" },
  ];
  const devContents = [
    {
      name: "Github Repository",
      link: "https://github.com/BlueShapes/station-sign-generator",
      target: "_blank",
    },
    {
      name: "Issues (Bug Reports & Feature Requests)",
      link: "https://github.com/BlueShapes/station-sign-generator/issues",
      target: "_blank",
    },
  ];

  return (
    <Grid gutter="md" style={{ padding: "10px" }}>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <Title order={6}>Links</Title>
        <List spacing="xs" icon={<IconChevronsRight size={16} />}>
          {linkContents.map((e) => (
            <List.Item key={e.link}>
              <Anchor href={e.link} underline="never">
                {e.name}
              </Anchor>
            </List.Item>
          ))}
        </List>
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6 }}>
        <Title order={6}>Development Resources</Title>
        <List spacing="xs" icon={<IconChevronsRight size={16} />}>
          {devContents.map((e) => (
            <List.Item key={e.link}>
              <Anchor href={e.link} underline="never">
                {e.name}
              </Anchor>
            </List.Item>
          ))}
        </List>
      </Grid.Col>
      <Grid.Col span={12} style={{ textAlign: "center", margin: "60px 0 80px" }}>
        <Text>Copyright 2025 BlueShapes</Text>
        <Text>(Blue Triangle and sysnote8)</Text>
        <Text>MIT License</Text>
      </Grid.Col>
    </Grid>
  );
};

export default Footer;
