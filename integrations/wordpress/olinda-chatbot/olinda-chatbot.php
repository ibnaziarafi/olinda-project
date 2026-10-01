<?php
/**
 * Plugin Name: Olinda Chatbot
 * Description: Adds the hosted Olinda chatbot to your website. No API keys required.
 * Version: 1.0.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

function olinda_widget_options() {
    return wp_parse_args((array) get_option('olinda_widget_options', array()), array(
        'enabled' => 1,
        'name' => 'Olinda',
        'college' => 'Hobart College',
        'auto_open' => 0,
        'privacy_url' => '',
    ));
}

function olinda_widget_sanitize($input) {
    $input = is_array($input) ? $input : array();
    $privacy = esc_url_raw(isset($input['privacy_url']) ? $input['privacy_url'] : '', array('https'));
    return array(
        'enabled' => empty($input['enabled']) ? 0 : 1,
        'name' => sanitize_text_field(isset($input['name']) ? $input['name'] : '') ?: 'Olinda',
        'college' => sanitize_text_field(isset($input['college']) ? $input['college'] : '') ?: 'Hobart College',
        'auto_open' => empty($input['auto_open']) ? 0 : 1,
        'privacy_url' => $privacy,
    );
}

add_action('admin_init', function () {
    register_setting('olinda_widget_settings', 'olinda_widget_options', array(
        'type' => 'array',
        'sanitize_callback' => 'olinda_widget_sanitize',
        'show_in_rest' => false,
    ));
});

add_action('admin_menu', function () {
    add_options_page('Olinda Chatbot', 'Olinda Chatbot', 'manage_options', 'olinda-chatbot', 'olinda_widget_settings_page');
});

function olinda_widget_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $options = olinda_widget_options();
    ?>
    <div class="wrap">
        <h1>Olinda Chatbot</h1>
        <p>The widget uses your existing Olinda backend. Do not enter AI or database keys here.</p>
        <p>Your website domain must be approved in the chatbot backend's FRONTEND_ORIGINS setting.</p>
        <form action="options.php" method="post">
            <?php settings_fields('olinda_widget_settings'); ?>
            <table class="form-table" role="presentation">
                <tr><th scope="row">Show chatbot</th><td><label><input type="checkbox" name="olinda_widget_options[enabled]" value="1" <?php checked($options['enabled'], 1); ?>> Enable on all public pages</label></td></tr>
                <tr><th scope="row"><label for="olinda-name">Chatbot name</label></th><td><input id="olinda-name" class="regular-text" name="olinda_widget_options[name]" value="<?php echo esc_attr($options['name']); ?>"></td></tr>
                <tr><th scope="row"><label for="olinda-college">College name</label></th><td><input id="olinda-college" class="regular-text" name="olinda_widget_options[college]" value="<?php echo esc_attr($options['college']); ?>"></td></tr>
                <tr><th scope="row">Open automatically</th><td><label><input type="checkbox" name="olinda_widget_options[auto_open]" value="1" <?php checked($options['auto_open'], 1); ?>> Open chat when the page loads</label></td></tr>
                <tr><th scope="row"><label for="olinda-privacy">Privacy notice URL</label></th><td><input id="olinda-privacy" type="url" class="regular-text" name="olinda_widget_options[privacy_url]" value="<?php echo esc_attr($options['privacy_url']); ?>"><p class="description">Optional HTTPS link to your approved privacy notice.</p></td></tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

add_action('wp_enqueue_scripts', function () {
    $options = olinda_widget_options();
    if (!$options['enabled']) {
        return;
    }
    wp_enqueue_script('olinda-chatbot-widget', 'https://olinda.rafistacks.dev/widget.js', array(), '1.0.0', array(
        'strategy' => 'defer',
        'in_footer' => true,
    ));
});

add_filter('script_loader_tag', function ($tag, $handle) {
    if ($handle !== 'olinda-chatbot-widget') {
        return $tag;
    }
    $options = olinda_widget_options();
    $processor = new WP_HTML_Tag_Processor($tag);
    if ($processor->next_tag('SCRIPT')) {
        $processor->set_attribute('data-backend', 'https://olinda-ai-backend-chatbot.onrender.com');
        $processor->set_attribute('data-name', $options['name']);
        $processor->set_attribute('data-college', $options['college']);
        $processor->set_attribute('data-auto-open', $options['auto_open'] ? 'true' : 'false');
        if ($options['privacy_url']) {
            $processor->set_attribute('data-privacy-url', $options['privacy_url']);
        }
    }
    return $processor->get_updated_html();
}, 10, 2);
