CREATE OR REPLACE FUNCTION public.tidy_device_value(_v text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  known text[] := ARRAY[
    'iPhone','iPad','iMac','iPod','MacBook','Mac','AirPods','AirTag','Apple','Watch',
    'Samsung','Galaxy','Xiaomi','Redmi','Realme','Oppo','Vivo','Huawei','Honor','OnePlus',
    'Nokia','Motorola','Infinix','Tecno','Cherry','Mobile','Lenovo','ThinkPad','IdeaPad',
    'Dell','Inspiron','Latitude','XPS','Alienware','Acer','Aspire','Nitro','Predator',
    'ASUS','ROG','TUF','ZenBook','VivoBook','ExpertBook','Zephyrus','MSI','HP','Pavilion',
    'EliteBook','ProBook','Omen','Victus','LG','Sony','PlayStation','Xbox','Nintendo',
    'Switch','Toshiba','Fujitsu','Panasonic','Google','Pixel','Microsoft','Surface','GoPro',
    'Hero','Canon','Epson','Gigabyte','Seagate','Beats','Chuwi','Machenike','Retina','Chip',
    'Inch','Gen','Pro','Max','Mini','Plus','Air','Ultra','Prime','Lite','Gray','Grey','Space',
    'Silver','Gold','Rose','Midnight','Starlight','Graphite','Titanium','Sierra','Blue','Black',
    'White','Red','Green','Purple','Yellow','Pink','Natural','Desert','Deep','Jet','Matte','Glossy'
  ];
  tok text;
  bare text;
  k text;
  res text;
  found boolean;
  parts text[] := '{}';
BEGIN
  IF _v IS NULL THEN RETURN NULL; END IF;
  res := btrim(regexp_replace(_v, '\s+', ' ', 'g'));
  IF res = '' THEN RETURN res; END IF;

  FOREACH tok IN ARRAY string_to_array(res, ' ') LOOP
    bare := regexp_replace(tok, '[^A-Za-z0-9+]', '', 'g');
    IF bare = '' THEN
      parts := parts || tok;
      CONTINUE;
    END IF;

    found := false;
    FOREACH k IN ARRAY known LOOP
      IF lower(k) = lower(bare) THEN
        parts := parts || replace(tok, bare, k);
        found := true;
        EXIT;
      END IF;
    END LOOP;
    IF found THEN CONTINUE; END IF;

    IF bare ~* '^[0-9]+(\.[0-9]+)?(gb|tb|mb)$'
       OR lower(bare) IN ('ssd','hdd','oem','lcd','oled','led','usb','cpu','gpu','ram','pc','tv','se','xr','xs') THEN
      parts := parts || replace(tok, bare, upper(bare));
      CONTINUE;
    END IF;

    -- Ordinals such as 5th, 3rd, 1st stay lower-case.
    IF bare ~* '^[0-9]+(st|nd|rd|th)$' THEN
      parts := parts || replace(tok, bare, lower(bare));
      CONTINUE;
    END IF;

    IF bare ~ '[0-9]' AND bare ~ '[A-Za-z]' THEN
      parts := parts || replace(tok, bare, upper(bare));
      CONTINUE;
    END IF;

    IF bare ~ '^[0-9]+$' THEN
      parts := parts || tok;
      CONTINUE;
    END IF;

    parts := parts || replace(tok, bare, initcap(lower(bare)));
  END LOOP;

  RETURN array_to_string(parts, ' ');
END;
$$;